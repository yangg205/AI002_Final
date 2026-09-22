"""Prepare both shared indexes before either chat interface starts."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import knn_router
import rag_engine


def main():
    if not rag_engine.gemini_api_key():
        raise RuntimeError("GEMINI_API_KEY is required to initialize WHO and kNN indexes")
    print(rag_engine.index_if_needed(progress=print), flush=True)
    print(knn_router.index_examples(progress=print), flush=True)
    if rag_engine.collection_count() <= 0 or not knn_router.is_ready():
        raise RuntimeError("WHO or kNN index is empty; chat services cannot start")


if __name__ == "__main__":
    main()
