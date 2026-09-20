import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import config
import rag_engine


def print_status() -> dict:
    status = rag_engine.store_status()
    print("vector_store   :", status["path"])
    print("manifest co    :", status["exists"])
    print("can index lai  :", status["needs_indexing"])
    print("so chunk       :", status["chunks"])
    print("co GEMINI key  :", status["has_gemini_key"])
    print("embed model    :", config.GEMINI_EMBED_MODEL)
    print("collection     :", config.CHROMA_COLLECTION_NAME)
    return status


def main() -> int:
    args = sys.argv[1:]

    if "--status" in args:
        print_status()
        return 0

    if "--query" in args:
        position = args.index("--query")
        if position + 1 >= len(args):
            print("Thieu noi dung cau truy van sau --query")
            return 2
        question = args[position + 1]
        outcome = rag_engine.retrieve_in_scope(question)
        print("cau hoi     :", question)
        print("nguon       :", outcome["source"])
        print("trong pham vi:", outcome["in_scope"])
        score = outcome["top_score"]
        print(
            "score cao nhat:",
            "{0:.4f}".format(score) if isinstance(score, float) else "-",
            "| nguong:",
            config.RAG_SIMILARITY_THRESHOLD,
        )
        if outcome["error"]:
            print("loi         :", outcome["error"])
        for index, hit in enumerate(outcome["hits"], start=1):
            print(
                "\n[{i}] skill={skill} | trang={pages} | kind={kind} | score={score}".format(
                    i=index,
                    skill=hit["skill"],
                    pages=hit["pages"],
                    kind=hit["kind"],
                    score="{0:.4f}".format(hit["score"])
                    if isinstance(hit["score"], float)
                    else "-",
                )
            )
            print(hit["text"][:400].strip())
        return 0

    status = print_status()
    if not status["has_gemini_key"]:
        print(
            "\nDUNG: chua co {env} trong .env, khong the tao embedding.".format(
                env=config.GEMINI_API_KEY_ENV
            )
        )
        return 1

    force = "--force" in args
    print("\nBat dau index (force={0})...".format(force))
    result = rag_engine.index_if_needed(force=force, progress=lambda m: print("  ", m))
    print("\nket qua:", result)
    print_status()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

