"""Check supplemental documents and citations without calling external models."""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import chat_pipeline
import config
import llm
import rag_engine


class RelaxationDocumentsTests(unittest.TestCase):
    def test_supplement_preserves_who_chunks_and_has_real_sources(self):
        chunks = rag_engine.build_chunks({10: "WHO grounding content"})
        self.assertEqual(chunks[0]["id"], "grounding-p10-10")
        self.assertIn("WHO grounding content", chunks[0]["text"])
        supplemental = [c for c in chunks if c["kind"] == "supplemental"]
        self.assertEqual({c["skill"] for c in supplemental}, {"music", "dance"})
        for chunk in supplemental:
            self.assertEqual(chunk["pages"], [])
            self.assertTrue(chunk["source_url"].startswith("https://"))

    def test_external_citations_are_not_attributed_to_who_book_pages(self):
        hits = rag_engine.build_chunks({})
        citation = chat_pipeline.format_citation({"hits": hits + hits})
        self.assertEqual(citation.count("https://www.nccih.nih.gov"), 1)
        self.assertEqual(citation.count("https://www.who.int"), 1)
        self.assertNotIn("trang", citation)
        self.assertIn("NCCIH", llm._format_context(hits))

    def test_answer_contains_evidence_even_when_language_model_unavailable(self):
        for hit in rag_engine.build_chunks({}):
            with self.subTest(skill=hit["skill"]), \
                 patch.object(rag_engine, "retrieve_in_scope", return_value={
                     "in_scope": True, "hits": [hit], "source": "rag", "top_score": .9,
                 }), patch.object(llm, "is_available", return_value=False):
                reply, source, _ = chat_pipeline.answer_from_documents(
                    "Vì sao bài tập này giúp thư giãn?", include_citation=True)
                self.assertEqual(source, "extractive")
                self.assertIn(hit["text"], reply)
                self.assertIn(hit["source_url"], reply)

    def test_training_rows_keep_existing_schema_and_unique_ids(self):
        rows = [json.loads(line) for line in config.KNN_EXAMPLES_PATH.read_text(
            encoding="utf-8").splitlines() if line.strip()]
        self.assertEqual(len(rows), len({r["id"] for r in rows}))
        for row in rows:
            self.assertEqual(set(row), {"id", "kind", "label", "split", "text"})


if __name__ == "__main__":
    unittest.main()
