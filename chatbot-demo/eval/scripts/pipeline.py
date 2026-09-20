import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "src"))

import config
import guardrails
import knn_router
import llm
import rag_engine

NO_RAG_BASELINE_PROMPT_VI = (
    "Bạn là một trợ lý hỗ trợ cảm xúc chung chung. Trả lời ngắn gọn câu hỏi "
    "sau bằng kiến thức của bạn, không cần trích nguồn. (Đây là chế độ "
    "ablation phục vụ đánh giá tuần 3, KHÔNG phải app thật.)"
)


def run_turn(text: str, history=None, no_rag: bool = False) -> dict:
    history = history or []
    risk_outcome = guardrails.assess_risk(text)
    if risk_outcome["risk"]:
        return {
            "input": text,
            "risk_outcome": risk_outcome,
            "blocked": True,
            "risk_layer": risk_outcome.get("layer"),
            "intent": None,
            "reply": None,
            "reply_source": None,
            "retrieval": None,
        }

    decision = knn_router.reconcile_intent(llm.classify_intent(text), text)
    intent = decision["intent"]
    retrieval = None

    if intent == config.INTENT_ADVICE:
        if no_rag:
            try:
                reply = llm.complete(
                    [
                        {"role": "system", "content": NO_RAG_BASELINE_PROMPT_VI},
                        {"role": "user", "content": text},
                    ]
                )
                source = "no_rag_baseline"
            except Exception as error:
                reply = "(loi goi LLM: {0})".format(error)
                source = "no_rag_baseline_error"
        else:
            retrieval = rag_engine.retrieve_in_scope(text)
            if retrieval.get("source") == "rag_error":
                reply, source = config.RAG_ERROR_MESSAGE_VI, "rag_error"
            elif not retrieval["in_scope"] or not retrieval["hits"]:
                reply, source = config.RAG_OUT_OF_SCOPE_MESSAGE_VI, "out_of_scope"
            else:
                reply, source = llm.answer_with_context(text, retrieval["hits"], history)
    elif intent == config.INTENT_META:
        reply, source = config.META_ANSWER_VI, "meta"
    else:
        reply, source = llm.reply(text, history)

    return {
        "input": text,
        "risk_outcome": risk_outcome,
        "blocked": False,
        "risk_layer": risk_outcome.get("layer"),
        "intent": intent,
        "intent_llm": decision.get("llm_intent"),
        "intent_knn": decision.get("knn_intent"),
        "intent_agreed": decision.get("agreed"),
        "reply": reply,
        "reply_source": source,
        "retrieval": retrieval,
    }

