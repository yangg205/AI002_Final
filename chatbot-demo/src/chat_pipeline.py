"""Shared chat routing used by Streamlit and API clients.

This module owns the intent -> RAG/listening/meta decision so every interface
uses the same backend behavior. UI-specific session and rendering stay outside.
"""

import logging

import config
import guardrails
import knn_router
import llm
import rag_engine

__all__ = ["assess_risk", "generate_reply", "answer_from_documents", "format_citation"]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def assess_risk(text: str) -> dict:
    text_length = len(text or "")
    logger.info("Incoming chat message: characters=%d", text_length)
    outcome = guardrails.assess_risk(text)
    logger.info(
        "Guardrail check finished: risk=%s layer=%s",
        outcome.get("risk"),
        outcome.get("layer"),
    )
    return outcome


def generate_reply(text: str, history=None, include_citation: bool = False) -> dict:
    history = list(history or [])
    decision = knn_router.reconcile_intent(llm.classify_intent(text), text)
    intent = decision["intent"]
    retrieval = None

    if intent == config.INTENT_ADVICE:
        reply, source, retrieval = answer_from_documents(
            text, history, include_citation=include_citation
        )
    elif intent == config.INTENT_META:
        reply, source = config.META_ANSWER_VI, "meta"
    else:
        reply, source = llm.reply(text, history)

    logger.info(
        "Chat response ready: intent=%s source=%s retrieval=%s hits=%d",
        intent,
        source,
        (retrieval or {}).get("source", "not_used"),
        len((retrieval or {}).get("hits") or []),
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
    outcome = rag_engine.retrieve_in_scope(question)

    if outcome.get("source") == "rag_error":
        return config.RAG_ERROR_MESSAGE_VI, "rag_error", outcome
    if not outcome["in_scope"] or not outcome["hits"]:
        return config.RAG_OUT_OF_SCOPE_MESSAGE_VI, "out_of_scope", outcome

    content, source = llm.answer_with_context(question, outcome["hits"], history)
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
    return "_{prefix}: {body}_".format(
        prefix=config.RAG_CITATION_PREFIX_VI, body="; ".join(parts)
    )
