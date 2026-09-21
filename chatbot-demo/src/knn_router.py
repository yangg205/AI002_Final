"""Layer 1b: bo dinh tuyen ngu nghia bang kNN tren bo cau mau da gan nhan.

Chi co hai nguoi dung: guardrails.assess_risk (bo phieu nguy co) va buoc phan
loai y dinh. Module khong bao gio raise ra ngoai: moi loi deu tra ve trong
truong "error" de tang tren van chay tiep (fail-open o day la dung, vi lop 2
da tu fail-safe).

Cau hoi cua nguoi dung chi nam trong bo nho tien trinh (lru_cache), khong bao
gio duoc ghi xuong dia - dung nguyen tac khong luu hoi thoai cua du an.
"""

import hashlib
import json
import logging
from functools import lru_cache

import config
import masking
import rag_engine

__all__ = [
    "load_examples",
    "needs_indexing",
    "index_examples",
    "store_status",
    "is_ready",
    "neighbors",
    "decide_risk",
    "decide_intent",
    "risk_vote",
    "intent_vote",
    "apply_intent_policy",
    "reconcile_intent",
    "INTENT_POLICIES",
    "INTENT_CLARIFY",
]


class KnnUnavailable(RuntimeError):
    pass


_collection_singleton = None
_LOGGER = logging.getLogger(__name__)
_LOGGED_UNREADY_KINDS = set()


def _log_unready_once(kind: str, reason: str) -> None:
    label = kind or "all"
    if label not in _LOGGED_UNREADY_KINDS:
        _LOGGER.warning("kNN router unavailable: kind=%s reason=%s", label, reason)
        _LOGGED_UNREADY_KINDS.add(label)


def load_examples(split: str = None, kind: str = None) -> "list[dict]":
    rows = []
    path = config.KNN_EXAMPLES_PATH
    if not path.exists():
        raise KnnUnavailable("khong tim thay {0}".format(path))

    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            row = json.loads(line)
            if split and row.get("split") != split:
                continue
            if kind and row.get("kind") != kind:
                continue
            rows.append(row)
    return rows


def _examples_sha256() -> str:
    digest = hashlib.sha256()
    with open(config.KNN_EXAMPLES_PATH, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _manifest_path():
    return config.VECTOR_STORE_DIR / config.KNN_MANIFEST_FILENAME


def _expected_manifest() -> dict:
    train = load_examples(split="train")
    labels = {}
    for row in train:
        key = "{0}:{1}".format(row.get("kind"), row.get("label"))
        labels[key] = labels.get(key, 0) + 1
    return {
        "examples_sha256": _examples_sha256(),
        "embed_model": config.GEMINI_EMBED_MODEL,
        "embed_dimensions": config.GEMINI_EMBED_DIMENSIONS,
        "task_type": config.GEMINI_TASK_TYPE_SIMILARITY,
        "collection": config.CHROMA_EXAMPLES_COLLECTION_NAME,
        "n_train": len(train),
        "labels": labels,
    }


def _read_manifest():
    path = _manifest_path()
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return None


def needs_indexing() -> bool:
    manifest = _read_manifest()
    if manifest is None:
        return True
    try:
        return manifest != _expected_manifest()
    except KnnUnavailable:
        return True


def index_examples(force: bool = False, progress=None) -> dict:
    def notify(message):
        if progress:
            progress(message)

    if not force and not needs_indexing():
        return {"indexed": False, "examples": example_count(), "reason": "bo cau mau van hop le"}

    rows = load_examples(split="train")
    if not rows:
        raise KnnUnavailable("khong co dong nao split=train trong bo cau mau")

    notify("dang embed {0} cau mau...".format(len(rows)))
    vectors = rag_engine.embed_texts(
        [row["text"] for row in rows],
        config.GEMINI_TASK_TYPE_SIMILARITY,
        progress=progress,
    )

    client = rag_engine.chroma_client()
    try:
        client.delete_collection(config.CHROMA_EXAMPLES_COLLECTION_NAME)
    except Exception:
        pass

    collection = client.create_collection(
        name=config.CHROMA_EXAMPLES_COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    collection.add(
        ids=[row["id"] for row in rows],
        documents=[row["text"] for row in rows],
        embeddings=vectors,
        metadatas=[
            {"kind": row["kind"], "label": row["label"], "split": row["split"]}
            for row in rows
        ],
    )

    config.VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
    with open(_manifest_path(), "w", encoding="utf-8") as handle:
        json.dump(_expected_manifest(), handle, ensure_ascii=False, indent=2)

    global _collection_singleton
    _collection_singleton = None
    _query_vector.cache_clear()

    notify("da index xong")
    return {"indexed": True, "examples": len(rows), "reason": "da index lai bo cau mau"}


def _collection():
    global _collection_singleton
    if _collection_singleton is None:
        _collection_singleton = rag_engine.chroma_client().get_collection(
            config.CHROMA_EXAMPLES_COLLECTION_NAME
        )
    return _collection_singleton


def example_count() -> int:
    try:
        return int(_collection().count())
    except Exception:
        return 0


def store_status() -> dict:
    counts = {}
    try:
        collection = _collection()
        payload = collection.get(include=["metadatas"])
        for metadata in payload.get("metadatas") or []:
            key = "{0}:{1}".format(metadata.get("kind"), metadata.get("label"))
            counts[key] = counts.get(key, 0) + 1
        total = len(payload.get("ids") or [])
    except Exception:
        total = 0

    return {
        "collection": config.CHROMA_EXAMPLES_COLLECTION_NAME,
        "manifest_exists": _manifest_path().exists(),
        "needs_indexing": needs_indexing(),
        "examples": total,
        "by_label": counts,
        "has_gemini_key": bool(rag_engine.gemini_api_key()),
    }


def is_ready(kind: str = None) -> bool:
    try:
        if needs_indexing():
            _log_unready_once(kind, "index_required")
            return False
    except Exception as error:
        _LOGGER.warning(
            "kNN readiness check failed: kind=%s error=%s: %s",
            kind or "all",
            type(error).__name__,
            rag_engine._redact_gemini_api_key(str(error)),
        )
        return False
    if example_count() <= 0:
        _log_unready_once(kind, "empty_index")
        return False
    if kind is None:
        return True
    try:
        payload = _collection().get(where={"kind": kind}, include=[])
        return bool(payload.get("ids"))
    except Exception as error:
        _LOGGER.warning(
            "kNN readiness check failed: kind=%s error=%s: %s",
            kind or "all",
            type(error).__name__,
            rag_engine._redact_gemini_api_key(str(error)),
        )
        return False


@lru_cache(maxsize=config.KNN_QUERY_CACHE_SIZE)
def _query_vector(text: str) -> tuple:
    payload = text
    if config.KNN_MASK_QUERY:
        payload = masking.mask_text(text)
    return tuple(rag_engine.embed_texts([payload], config.GEMINI_TASK_TYPE_SIMILARITY)[0])


def neighbors(text: str, kind: str, k: int = None) -> "list[dict]":
    """Tra ve danh sach lang gieng gan nhat, da sap xep giam dan theo score.

    Luon lay KNN_NEIGHBOR_POOL lang gieng de cac ban quet nguong offline dung
    lai duoc cung mot danh sach ma khong phai goi embedding them lan nao.
    """
    text = (text or "").strip()
    if not text:
        return []

    pool = max(config.KNN_NEIGHBOR_POOL, k or config.KNN_TOP_K)
    vector = list(_query_vector(text))
    payload = _collection().query(
        query_embeddings=[vector],
        n_results=pool,
        where={"kind": kind},
        include=["documents", "metadatas", "distances"],
    )

    ids = (payload.get("ids") or [[]])[0]
    documents = (payload.get("documents") or [[]])[0]
    metadatas = (payload.get("metadatas") or [[]])[0]
    distances = (payload.get("distances") or [[]])[0]

    hits = []
    for example_id, document, metadata, distance in zip(ids, documents, metadatas, distances):
        metadata = metadata or {}
        hits.append(
            {
                "id": example_id,
                "text": document,
                "kind": metadata.get("kind"),
                "label": metadata.get("label"),
                "score": 1.0 - float(distance),
            }
        )
    hits.sort(key=lambda hit: hit["score"], reverse=True)
    return hits


def decide_risk(hits, k: int = None, threshold: float = None, min_votes: int = None) -> dict:
    """Ham thuan: chi doc danh sach lang gieng, khong goi API.

    Nho vay cac ban quet (k, threshold, min_votes) chay offline tren cung mot
    danh sach da cache.
    """
    k = k or config.KNN_TOP_K
    threshold = config.KNN_RISK_THRESHOLD if threshold is None else threshold
    min_votes = config.KNN_RISK_MIN_VOTES if min_votes is None else min_votes

    window = list(hits or [])[:k]
    voters = [hit for hit in window if hit["label"] == "risk" and hit["score"] >= threshold]
    top_risk = max((hit["score"] for hit in window if hit["label"] == "risk"), default=None)
    nearest = window[0] if window else None

    risk = len(voters) >= min_votes
    confidence = None
    if risk:
        confidence = "high" if top_risk >= threshold + config.KNN_RISK_HIGH_MARGIN else "medium"

    return {
        "risk": risk,
        "score": top_risk,
        "votes": len(voters),
        "k": len(window),
        "threshold": threshold,
        "min_votes": min_votes,
        "confidence": confidence,
        "nearest_id": nearest["id"] if nearest else None,
        "nearest_label": nearest["label"] if nearest else None,
        "nearest_text": nearest["text"] if nearest else None,
        "error": None,
    }


def decide_intent(hits, k: int = None, threshold: float = None) -> dict:
    k = k or config.KNN_INTENT_TOP_K
    threshold = config.KNN_INTENT_THRESHOLD if threshold is None else threshold

    window = list(hits or [])[:k]
    if not window:
        return {
            "intent": None,
            "score": None,
            "votes": {},
            "k": 0,
            "threshold": threshold,
            "unanimous": False,
            "margin": None,
            "nearest_id": None,
            "error": None,
        }

    votes = {}
    for hit in window:
        votes[hit["label"]] = votes.get(hit["label"], 0) + 1
    intent = max(votes, key=lambda label: (votes[label], max(h["score"] for h in window if h["label"] == label)))

    best = max(hit["score"] for hit in window if hit["label"] == intent)
    others = [hit["score"] for hit in window if hit["label"] != intent]
    margin = best - max(others) if others else best

    return {
        "intent": intent,
        "score": best,
        "votes": votes,
        "k": len(window),
        "threshold": threshold,
        "unanimous": len(votes) == 1,
        "margin": margin,
        "nearest_id": window[0]["id"],
        "error": None,
    }


INTENT_POLICIES = (
    "llm_wins",
    "knn_confident",
    "knn_confident_else_sharing",
    "always_sharing",
    "clarify",
    "knn_wins",
)
INTENT_CLARIFY = "clarify"


def apply_intent_policy(llm_intent: str, knn: dict, policy: str = None) -> dict:
    """Ham thuan: quyet dinh nhan y dinh cuoi cung tu 2 nguon.

    Khong goi API, nen cac ban so sanh chinh sach chay offline duoc tu cache.
    """
    policy = policy or config.KNN_INTENT_POLICY
    knn = knn or {}
    knn_intent = knn.get("intent")
    score = knn.get("score")
    confident = bool(
        knn_intent
        and score is not None
        and score >= (knn.get("threshold") if knn.get("threshold") is not None else config.KNN_INTENT_THRESHOLD)
        and knn.get("unanimous")
    )
    agreed = bool(knn_intent) and knn_intent == llm_intent

    if policy == "knn_wins":
        intent = knn_intent or llm_intent
    elif not knn_intent or agreed:
        intent = llm_intent
    elif policy == "knn_confident":
        # kNN chi duoc ghi de KHI CHAC CHAN; con lai giu nhan cua LLM.
        # Bien the cu (ep ve sharing) lam hong cac cau advice ma LLM gan dung.
        intent = knn_intent if confident else llm_intent
    elif policy == "knn_confident_else_sharing":
        intent = knn_intent if confident else config.INTENT_FALLBACK
    elif policy == "always_sharing":
        intent = config.INTENT_FALLBACK
    elif policy == "clarify":
        intent = INTENT_CLARIFY
    else:
        intent = llm_intent

    return {
        "intent": intent,
        "policy": policy,
        "agreed": agreed,
        "confident": confident,
        "llm_intent": llm_intent,
        "knn_intent": knn_intent,
        "knn_score": score,
        "error": knn.get("error"),
    }


def reconcile_intent(llm_intent: str, text: str = None, policy: str = None) -> dict:
    if not (config.KNN_ENABLED and config.KNN_INTENT_ENABLED):
        return apply_intent_policy(llm_intent, None, policy="llm_wins")
    try:
        if not is_ready("intent"):
            return apply_intent_policy(llm_intent, None, policy="llm_wins")
    except Exception:
        return apply_intent_policy(llm_intent, None, policy="llm_wins")
    return apply_intent_policy(llm_intent, intent_vote(text or ""), policy=policy)


def _failed(payload: dict, error: Exception) -> dict:
    details = rag_engine._redact_gemini_api_key(str(error))
    _LOGGER.warning("kNN vote failed: error=%s: %s", type(error).__name__, details)
    payload["error"] = "{name}: {msg}".format(name=type(error).__name__, msg=details)
    return payload


def risk_vote(text: str) -> dict:
    try:
        return decide_risk(neighbors(text, "risk"))
    except Exception as error:
        return _failed(decide_risk([]), error)


def intent_vote(text: str) -> dict:
    try:
        return decide_intent(neighbors(text, "intent", k=config.KNN_INTENT_TOP_K))
    except Exception as error:
        return _failed(decide_intent([]), error)
