import hashlib
import json
import logging
import math
import os
import re
import time
import unicodedata
from pathlib import Path

from dotenv import load_dotenv

import config
import masking

load_dotenv(dotenv_path=config.PROJECT_ROOT / ".env")

__all__ = [
    "extract_pages",
    "build_chunks",
    "chunk_stats",
    "index_if_needed",
    "retrieve",
    "retrieve_in_scope",
    "skill_summaries",
    "store_status",
    "chroma_client",
    "embed_texts",
]


_HEADER_RE = re.compile(r"^(?:ph[aàầ]n|part)\s*\d+\s*:", re.IGNORECASE)
_HEADER_MAX_Y = 40.0
_PAGE_NUMBER_RE = re.compile(r"^\d{1,3}$")
_WS_RE = re.compile(r"[ \t\u00a0]+")
_LOGGER = logging.getLogger(__name__)


def _clean_block(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = _WS_RE.sub(" ", text)
    return text.strip()


def _page_text(page, page_number: int) -> str:
    lines = []
    for block in page.get_text("blocks"):
        if block[6] != 0:
            continue
        text = _clean_block(block[4])
        if not text:
            continue
        if block[1] <= _HEADER_MAX_Y and _HEADER_RE.match(text):
            continue
        if _PAGE_NUMBER_RE.match(text):
            continue
        lines.append(text)
    return "\n".join(lines).strip()


def extract_pages(pdf_path=None) -> "dict[int, str]":
    import fitz

    path = Path(pdf_path or config.DWM_PDF_PATH)
    if not path.exists():
        raise FileNotFoundError("Khong tim thay tai lieu nguon: " + str(path))

    doc = fitz.open(path)
    try:
        return {i + 1: _page_text(doc[i], i + 1) for i in range(doc.page_count)}
    finally:
        doc.close()


def skill_of_page(page_number: int):
    for skill, (first, last) in config.DWM_SKILL_PAGE_RANGES.items():
        if first <= page_number <= last:
            return skill
    for skill, number in config.DWM_SUMMARY_PAGES.items():
        if page_number == number:
            return skill
    return None


def _group_pages(numbers: "list[int]", texts: "dict[int, str]") -> "list[list[int]]":
    groups = []
    total = len(numbers)
    start = 0

    while start < total:
        group = [numbers[start]]
        chars = len(texts.get(numbers[start], ""))
        cursor = start + 1

        while cursor < total and len(group) < config.CHUNK_MAX_PAGES:
            nxt_chars = len(texts.get(numbers[cursor], ""))
            if chars >= config.CHUNK_TARGET_MIN_CHARS:
                if chars + nxt_chars > config.CHUNK_TARGET_MAX_CHARS:
                    break
            group.append(numbers[cursor])
            chars += nxt_chars
            cursor += 1

        if groups and set(group).issubset(set(groups[-1])):
            break
        groups.append(group)

        if cursor >= total:
            break
        start = max(start + 1, cursor - config.CHUNK_OVERLAP_PAGES)

    return groups


def build_chunks(pages=None) -> "list[dict]":
    texts = pages if pages is not None else extract_pages()
    chunks = []

    for skill, (first, last) in config.DWM_SKILL_PAGE_RANGES.items():
        numbers = [n for n in range(first, last + 1) if texts.get(n, "").strip()]
        for group in _group_pages(numbers, texts):
            body = "\n\n".join(texts[n] for n in group)
            chunks.append(
                {
                    "id": "{skill}-p{first}-{last}".format(
                        skill=skill, first=group[0], last=group[-1]
                    ),
                    "text": _with_heading(skill, group, body),
                    "skill": skill,
                    "pages": list(group),
                    "kind": "content",
                }
            )

    for skill, number in config.DWM_SUMMARY_PAGES.items():
        body = texts.get(number, "").strip()
        if not body:
            continue
        chunks.append(
            {
                "id": "{skill}-summary-p{page}".format(skill=skill, page=number),
                "text": _with_heading(skill, [number], body),
                "skill": skill,
                "pages": [number],
                "kind": "summary",
            }
        )

    return chunks


def _with_heading(skill: str, page_numbers: "list[int]", body: str) -> str:
    pages_label = ", ".join(str(n) for n in page_numbers)
    return "Kỹ năng: {title}\n(Tài liệu WHO, trang {pages})\n\n{body}".format(
        title=config.SKILL_TITLES_VI.get(skill, skill), pages=pages_label, body=body
    )


def chunk_stats(chunks: "list[dict]") -> "dict":
    per_skill = {}
    for chunk in chunks:
        entry = per_skill.setdefault(
            chunk["skill"], {"chunks": 0, "chars": 0, "pages": set()}
        )
        entry["chunks"] += 1
        entry["chars"] += len(chunk["text"])
        entry["pages"].update(chunk["pages"])

    sizes = [len(c["text"]) for c in chunks] or [0]
    return {
        "total_chunks": len(chunks),
        "min_chars": min(sizes),
        "max_chars": max(sizes),
        "avg_chars": sum(sizes) / len(sizes),
        "per_skill": {
            skill: {
                "chunks": value["chunks"],
                "avg_chars": value["chars"] / value["chunks"],
                "pages_covered": len(value["pages"]),
            }
            for skill, value in per_skill.items()
        },
    }


class EmbeddingError(RuntimeError):
    pass


def gemini_api_key():
    key = os.getenv(config.GEMINI_API_KEY_ENV, "").strip()
    return key or None


def _redact_gemini_api_key(message: str) -> str:
    key = gemini_api_key()
    if key:
        message = message.replace(key, "[REDACTED]")
    return message[:1000]


def embed_texts(texts: "list[str]", task_type: str, progress=None) -> "list[list[float]]":
    import requests

    key = gemini_api_key()
    if not key:
        raise EmbeddingError(
            "Thieu {env} trong .env - khong the tao embedding.".format(
                env=config.GEMINI_API_KEY_ENV
            )
        )

    model = "models/" + config.GEMINI_EMBED_MODEL
    url = "{base}/{model}:batchEmbedContents".format(
        base=config.GEMINI_API_BASE_URL, model=model
    )
    vectors = []
    batch_size = max(1, config.GEMINI_EMBED_BATCH_SIZE)

    for start in range(0, len(texts), batch_size):
        batch = texts[start : start + batch_size]
        payload = {
            "requests": [
                {
                    "model": model,
                    "content": {"parts": [{"text": text}]},
                    "taskType": task_type,
                    "outputDimensionality": config.GEMINI_EMBED_DIMENSIONS,
                }
                for text in batch
            ]
        }
        response = None
        for attempt in range(config.GEMINI_EMBED_MAX_RETRIES + 1):
            try:
                response = requests.post(
                    url,
                    params={"key": key},
                    json=payload,
                    timeout=config.GEMINI_EMBED_TIMEOUT_SECONDS,
                )
            except Exception as error:
                raise EmbeddingError("Loi mang khi goi Gemini: {0}".format(error))

            if response.status_code in (429, 500, 502, 503, 504):
                if attempt >= config.GEMINI_EMBED_MAX_RETRIES:
                    break
                delay = config.GEMINI_EMBED_RETRY_DELAY_SECONDS * (2 ** attempt)
                if progress:
                    progress(
                        "Gemini tra ve HTTP {code}, cho {delay}s roi thu lai "
                        "(lan {attempt}/{total})...".format(
                            code=response.status_code,
                            delay=delay,
                            attempt=attempt + 1,
                            total=config.GEMINI_EMBED_MAX_RETRIES,
                        )
                    )
                time.sleep(delay)
                continue
            break

        if response is None or response.status_code != 200:
            raise EmbeddingError(
                "Gemini tra ve HTTP {code}: {body}".format(
                    code="?" if response is None else response.status_code,
                    body="" if response is None else response.text[:300],
                )
            )
        try:
            data = response.json()
            batch_vectors = [item["values"] for item in data["embeddings"]]
        except Exception as error:
            raise EmbeddingError("Khong doc duoc phan hoi Gemini: {0}".format(error))

        if len(batch_vectors) != len(batch):
            raise EmbeddingError(
                "Gemini tra ve {got} vector cho {want} text.".format(
                    got=len(batch_vectors), want=len(batch)
                )
            )
        vectors.extend(_l2_normalize(vector) for vector in batch_vectors)

    return vectors


def _l2_normalize(vector):
    norm = math.sqrt(sum(value * value for value in vector))
    if not norm:
        return list(vector)
    return [value / norm for value in vector]


def _pdf_fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _expected_manifest() -> dict:
    return {
        "pdf_sha256": _pdf_fingerprint(Path(config.DWM_PDF_PATH)),
        "embed_model": config.GEMINI_EMBED_MODEL,
        "embed_dimensions": config.GEMINI_EMBED_DIMENSIONS,
        "collection": config.CHROMA_COLLECTION_NAME,
        "chunking": {
            "min_chars": config.CHUNK_TARGET_MIN_CHARS,
            "max_chars": config.CHUNK_TARGET_MAX_CHARS,
            "max_pages": config.CHUNK_MAX_PAGES,
            "overlap_pages": config.CHUNK_OVERLAP_PAGES,
            "skill_ranges": {
                k: list(v) for k, v in config.DWM_SKILL_PAGE_RANGES.items()
            },
            "summary_pages": dict(config.DWM_SUMMARY_PAGES),
        },
    }


def _manifest_path() -> Path:
    return Path(config.VECTOR_STORE_DIR) / config.RAG_MANIFEST_FILENAME


def _read_manifest():
    path = _manifest_path()
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return None


_chroma_client_singleton = None


def _chroma_client():
    global _chroma_client_singleton
    if _chroma_client_singleton is not None:
        return _chroma_client_singleton

    os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")
    logging.getLogger("chromadb.telemetry.product.posthog").setLevel(logging.CRITICAL)

    import chromadb
    from chromadb.config import Settings

    Path(config.VECTOR_STORE_DIR).mkdir(parents=True, exist_ok=True)
    _chroma_client_singleton = chromadb.PersistentClient(
        path=str(config.VECTOR_STORE_DIR),
        settings=Settings(anonymized_telemetry=False),
    )
    return _chroma_client_singleton


def chroma_client():
    """Client Chroma dung chung.

    Moi module khac (vi du knn_router) phai goi ham nay thay vi tu tao
    PersistentClient moi tren cung mot thu muc.
    """
    return _chroma_client()


def needs_indexing() -> bool:
    manifest = _read_manifest()
    if manifest is None:
        return True
    return manifest != _expected_manifest()


def index_if_needed(force: bool = False, progress=None) -> dict:
    if not force and not needs_indexing():
        return {
            "indexed": False,
            "chunks": collection_count(),
            "reason": "vector store is up to date",
        }

    def report(message):
        if progress:
            progress(message)

    report("Dang trich text tu PDF...")
    chunks = build_chunks()
    if not chunks:
        raise RuntimeError("Khong dung duoc chunk nao tu PDF.")

    report("Dang tao embedding cho {0} chunk...".format(len(chunks)))
    vectors = embed_texts(
        [c["text"] for c in chunks], config.GEMINI_TASK_TYPE_DOCUMENT, progress=report
    )

    report("Dang ghi vao ChromaDB...")
    client = _chroma_client()
    try:
        client.delete_collection(config.CHROMA_COLLECTION_NAME)
    except Exception:
        pass
    collection = client.create_collection(
        name=config.CHROMA_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    collection.add(
        ids=[c["id"] for c in chunks],
        documents=[c["text"] for c in chunks],
        embeddings=vectors,
        metadatas=[
            {
                "skill": c["skill"],
                "pages": ",".join(str(p) for p in c["pages"]),
                "kind": c["kind"],
            }
            for c in chunks
        ],
    )

    with open(_manifest_path(), "w", encoding="utf-8") as handle:
        json.dump(_expected_manifest(), handle, ensure_ascii=False, indent=2)

    report("Xong.")
    return {"indexed": True, "chunks": len(chunks), "reason": "reindexed"}


def collection_count() -> int:
    try:
        collection = _chroma_client().get_collection(config.CHROMA_COLLECTION_NAME)
        return collection.count()
    except Exception:
        return 0


def store_status() -> dict:
    return {
        "path": str(config.VECTOR_STORE_DIR),
        "exists": _manifest_path().exists(),
        "needs_indexing": needs_indexing(),
        "chunks": collection_count(),
        "has_gemini_key": bool(gemini_api_key()),
    }


def retrieve(query: str, k: int = None) -> "list[dict]":
    top_k = config.RAG_TOP_K if k is None else k
    query = (query or "").strip()
    if not query:
        return []

    collection = _chroma_client().get_collection(config.CHROMA_COLLECTION_NAME)
    query_vector = embed_texts([masking.mask_text(query)], config.GEMINI_TASK_TYPE_QUERY)[0]
    result = collection.query(
        query_embeddings=[query_vector],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    documents = (result.get("documents") or [[]])[0]
    metadatas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    hits = []
    for document, metadata, distance in zip(documents, metadatas, distances):
        metadata = metadata or {}
        pages = [
            int(part)
            for part in str(metadata.get("pages", "")).split(",")
            if part.strip().isdigit()
        ]
        hits.append(
            {
                "text": document,
                "skill": metadata.get("skill"),
                "pages": pages,
                "kind": metadata.get("kind"),
                "score": 1.0 - float(distance),
            }
        )
    hits.sort(key=lambda hit: hit["score"], reverse=True)
    return hits


def retrieve_in_scope(query: str, k: int = None) -> dict:
    query_length = len((query or "").strip())
    try:
        hits = retrieve(query, k)
    except Exception as error:
        details = _redact_gemini_api_key(str(error))
        _LOGGER.error(
            "RAG retrieval failed: query_chars=%d error=%s: %s",
            query_length,
            type(error).__name__,
            details,
        )
        return _error_result(
            "{name}: {msg}".format(name=type(error).__name__, msg=details)
        )

    if not hits:
        _LOGGER.error(
            "RAG returned no chunks: query_chars=%d collection=%s vector_store=%s",
            query_length,
            config.CHROMA_COLLECTION_NAME,
            config.VECTOR_STORE_DIR,
        )
        return _error_result("RAG khong tra ve chunk nao")

    top_score = hits[0]["score"]
    in_scope = top_score >= config.RAG_SIMILARITY_THRESHOLD
    _LOGGER.info(
        "RAG retrieval completed: query_chars=%d hits=%d top_score=%.3f in_scope=%s",
        query_length,
        len(hits),
        top_score,
        in_scope,
    )
    return {
        "in_scope": in_scope,
        "hits": hits if in_scope else [],
        "top_score": top_score,
        "source": "rag",
        "error": None,
    }


def _error_result(error: str) -> dict:
    return {
        "in_scope": False,
        "hits": [],
        "top_score": None,
        "source": "rag_error",
        "error": error,
    }


_SUMMARY_LABEL_RE = re.compile(r"^(?:tóm tắt|công cụ\s*\d+\s*:.*)$", re.IGNORECASE)
_SUMMARY_STEP_RE = re.compile(r"\s+(\d\))")


def _summary_body(document: str) -> str:
    lines = document.split("\n\n", 1)[-1].splitlines()
    while lines and (not lines[0].strip() or _SUMMARY_LABEL_RE.match(lines[0].strip())):
        lines.pop(0)
    body = _WS_RE.sub(" ", " ".join(lines)).strip()
    return _SUMMARY_STEP_RE.sub(r"\n\n\1", body)


def skill_summaries(skills) -> "list[dict]":
    collection = _chroma_client().get_collection(config.CHROMA_COLLECTION_NAME)
    summaries = []
    for skill in skills:
        result = collection.get(
            where={"$and": [{"kind": "summary"}, {"skill": skill}]},
            include=["documents", "metadatas"],
        )
        documents = result.get("documents") or []
        if not documents:
            continue
        metadata = (result.get("metadatas") or [{}])[0] or {}
        summaries.append(
            {
                "skill": skill,
                "title": config.SKILL_TITLES_VI.get(skill, skill),
                "pages": str(metadata.get("pages", "")),
                "body": _summary_body(documents[0]),
            }
        )
    return summaries
