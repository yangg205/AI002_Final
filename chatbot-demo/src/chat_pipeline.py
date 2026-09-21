"""Shared chat routing used by Streamlit and API clients.

This module owns the intent -> RAG/listening/meta decision so every interface
uses the same backend behavior. UI-specific session and rendering stay outside.
"""

import logging
import os
import time

import config
import guardrails
import knn_router
import llm
import rag_engine

__all__ = ["assess_risk", "generate_reply", "answer_from_documents", "format_citation"]

_configured_log_level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
logging.basicConfig(
    level=_configured_log_level,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger().setLevel(_configured_log_level)
logger = logging.getLogger(__name__)


def assess_risk(text: str) -> dict:
    started = time.perf_counter()
    text_length = len(text or "")
    logger.info("Incoming chat message: characters=%d", text_length)
    outcome = guardrails.assess_risk(text)
    logger.info(
        "Guardrail check finished: risk=%s layer=%s elapsed_ms=%.1f",
        outcome.get("risk"),
        outcome.get("layer"),
        (time.perf_counter() - started) * 1000,
    )
    return outcome


def generate_reply(text: str, history=None, include_citation: bool = False) -> dict:
    started = time.perf_counter()
    history = list(history or [])
    logger.info("Intent classification started: chars=%d history_messages=%d", len(text or ""), len(history))
    llm_intent = llm.classify_intent(text)
    if llm.last_intent_error():
        logger.warning("Intent LLM fallback used: error_present=%s", bool(llm.last_intent_error()))
    decision = knn_router.reconcile_intent(llm_intent, text)
    logger.info(
        "Intent classification finished: llm=%s knn=%s selected=%s policy=%s error=%s elapsed_ms=%.1f",
        llm_intent,
        decision.get("knn_intent"),
        decision.get("intent"),
        decision.get("policy"),
        bool(decision.get("error")),
        (time.perf_counter() - started) * 1000,
    )
    intent = decision["intent"]
    retrieval = None

    if intent == config.INTENT_ADVICE:
        logger.info("Response route selected: rag")
        reply, source, retrieval = answer_from_documents(
            text, history, include_citation=include_citation
        )
    elif intent == config.INTENT_META:
        logger.info("Response route selected: meta")
        reply, source = config.META_ANSWER_VI, "meta"
    else:
        logger.info("Response route selected: conversation_llm")
        reply, source = llm.reply(text, history)

    logger.info(
        "Chat response ready: intent=%s source=%s retrieval=%s hits=%d elapsed_ms=%.1f",
        intent,
        source,
        (retrieval or {}).get("source", "not_used"),
        len((retrieval or {}).get("hits") or []),
        (time.perf_counter() - started) * 1000,
    )

    return {
        "intent": intent,
        "intent_decision": decision,
        "reply": reply,
        "reply_source": source,
        "retrieval": retrieval,
    }


def answer_from_documents(
    question: str, history=None, include_citation: bool = False
) -> tuple:
    started = time.perf_counter()
    logger.info("RAG retrieval started: question_chars=%d", len(question or ""))
    outcome = rag_engine.retrieve_in_scope(question)
    top_score = outcome.get("top_score")
    logger.info(
        "RAG retrieval finished: source=%s in_scope=%s hits=%d top_score=%s elapsed_ms=%.1f",
        outcome.get("source"),
        outcome.get("in_scope"),
        len(outcome.get("hits") or []),
        "%.3f" % top_score if isinstance(top_score, (float, int)) else "n/a",
        (time.perf_counter() - started) * 1000,
    )

    if outcome.get("source") == "rag_error":
        logger.error("RAG answer stopped: retrieval_error elapsed_ms=%.1f", (time.perf_counter() - started) * 1000)
        return config.RAG_ERROR_MESSAGE_VI, "rag_error", outcome
    if not outcome["in_scope"] or not outcome["hits"]:
        logger.info("RAG answer stopped: out_of_scope hits=%d", len(outcome.get("hits") or []))
        return config.RAG_OUT_OF_SCOPE_MESSAGE_VI, "out_of_scope", outcome

    content, source = llm.answer_with_context(question, outcome["hits"], history)
    logger.info("RAG grounded answer generated: source=%s hits=%d elapsed_ms=%.1f", source, len(outcome["hits"]), (time.perf_counter() - started) * 1000)
    if include_citation:
        citation = format_citation(outcome)
        if citation:
            content = content + "\n\n" + citation
    return content, source, outcome


def format_citation(outcome: dict) -> str:
    hits = outcome.get("hits") or []
    parts = []
    for hit in hits:
        pages = hit.get("pages") or []
        if not pages:
            continue
        pages_label = (
            "trang {0}".format(pages[0])
            if len(pages) == 1
            else "trang {0}-{1}".format(pages[0], pages[-1])
        )
        parts.append(
            "{skill} ({pages})".format(
                skill=config.SKILL_TITLES_VI.get(hit.get("skill"), hit.get("skill")),
                pages=pages_label,
            )
        )
    if not parts:
        return ""
    return "{prefix}: {body}".format(
        prefix=config.RAG_CITATION_PREFIX_VI, body="; ".join(parts)
    )
