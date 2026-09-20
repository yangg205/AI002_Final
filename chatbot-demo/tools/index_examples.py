import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import config
import knn_router


def print_status() -> dict:
    status = knn_router.store_status()
    print("collection     :", status["collection"])
    print("manifest co    :", status["manifest_exists"])
    print("can index lai  :", status["needs_indexing"])
    print("so cau mau     :", status["examples"])
    for key in sorted(status["by_label"]):
        print("  {0:<16} {1}".format(key, status["by_label"][key]))
    print("co GEMINI key  :", status["has_gemini_key"])
    print("embed model    :", config.GEMINI_EMBED_MODEL)
    print("task type      :", config.GEMINI_TASK_TYPE_SIMILARITY)
    return status


def main() -> int:
    args = sys.argv[1:]

    if "--status" in args:
        print_status()
        return 0

    if "--query" in args:
        position = args.index("--query")
        if position + 1 >= len(args):
            print("Thieu noi dung sau --query")
            return 2
        question = args[position + 1]
        kind = "risk"
        if "--kind" in args:
            kind_position = args.index("--kind")
            if kind_position + 1 < len(args):
                kind = args[kind_position + 1]

        hits = knn_router.neighbors(question, kind)
        print("cau hoi :", question)
        print("kind    :", kind)
        if not hits:
            print("(khong co lang gieng nao - da index chua?)")
            return 1
        for index, hit in enumerate(hits, start=1):
            print(
                "[{0}] {1:<12} label={2:<8} score={3:.3f}  {4}".format(
                    index, hit["id"], hit["label"], hit["score"], hit["text"][:70]
                )
            )
        if kind == "risk":
            print("\nquyet dinh:", knn_router.decide_risk(hits))
        else:
            print("\nquyet dinh:", knn_router.decide_intent(hits))
        return 0

    status = print_status()
    if not status["has_gemini_key"]:
        print("\nThieu {0} trong .env - khong the embed.".format(config.GEMINI_API_KEY_ENV))
        return 1

    force = "--force" in args
    result = knn_router.index_examples(force=force, progress=lambda m: print("  ", m))
    print("\nket qua:", result)
    print()
    print_status()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
