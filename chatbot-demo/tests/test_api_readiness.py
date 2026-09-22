"""Regression checks for missing indexes and chat response labels."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

import api
import initialize_indexes


class ReadinessTests(unittest.TestCase):
    def test_key_alone_does_not_mean_rag_is_available(self):
        with patch.object(api.llm, "is_available", return_value=True), \
             patch.object(api.rag_engine, "gemini_api_key", return_value="test-key"), \
             patch.object(api.rag_engine, "collection_count", return_value=0):
            self.assertFalse(api.health()["rag_available"])

    def test_response_modes_describe_actual_route(self):
        hit = {"skill": "grounding", "pages": [10], "text": "test"}
        cases = [
            ("rag_error", [], "unavailable"),
            ("out_of_scope", [], "scripted"),
            ("scripted", [], "scripted"),
            ("llm", [hit], "rag"),
            ("extractive", [hit], "rag"),
            ("llm", [], "ai"),
        ]
        for source, hits, expected in cases:
            with self.subTest(source=source, hits=bool(hits)), \
                 patch.object(api.chat_pipeline, "assess_risk", return_value={"risk": False}), \
                 patch.object(api.chat_pipeline, "generate_reply", return_value={
                     "intent": "advice", "reply": "test", "reply_source": source,
                     "retrieval": {"hits": hits},
                 }):
                result = api.chat(api.ChatRequest(message="test"), user=None)
                self.assertEqual(result["mode"], expected)

    def test_initialization_fails_if_indexes_remain_empty(self):
        with patch.object(initialize_indexes.rag_engine, "gemini_api_key", return_value="test-key"), \
             patch.object(initialize_indexes.rag_engine, "index_if_needed"), \
             patch.object(initialize_indexes.knn_router, "index_examples"), \
             patch.object(initialize_indexes.rag_engine, "collection_count", return_value=0):
            with self.assertRaisesRegex(RuntimeError, "index is empty"):
                initialize_indexes.main()


if __name__ == "__main__":
    unittest.main()
