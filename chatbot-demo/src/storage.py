"""Luu va doc lich su hoi thoai cua nguoi dung da dang nhap.

Hai nguyen tac, cho nay la cho duy nhat thuc thi chung:

1. MOI ham deu bat buoc co user_id va moi truy van deu loc theo user_id, nen
   mot tai khoan khong the doc hay xoa du lieu cua tai khoan khac.
2. Noi dung tin nhan LUON di qua masking.mask_text truoc khi ghi, nen so dien
   thoai / CCCD / email khong bao gio nam trong database.
"""

import json

import config
import db
import masking

__all__ = [
    "start_conversation",
    "save_message",
    "list_conversations",
    "load_messages",
    "delete_conversation",
    "delete_all_history",
    "build_user_meta",
    "build_assistant_meta",
]


def start_conversation(user_id: int, title: str = None) -> int:
    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO conversations (user_id, title) VALUES (%s, %s) RETURNING id",
                (user_id, (title or "")[:120] or None),
            )
            conversation_id = cursor.fetchone()[0]
        conn.commit()
    return conversation_id


def save_message(
    user_id: int,
    conversation_id: int,
    role: str,
    content: str,
    meta: dict = None,
    is_risk: bool = None,
    risk_layer: str = None,
    intent: str = None,
    reply_source: str = None,
) -> int:
    """Ghi mot tin nhan. Tra ve id, hoac None neu hoi thoai khong thuoc user_id."""
    masked = masking.mask_text(content or "")

    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO messages "
                "(conversation_id, role, content, is_risk, risk_layer, intent, reply_source, meta) "
                "SELECT %s, %s, %s, %s, %s, %s, %s, %s::jsonb "
                "WHERE EXISTS (SELECT 1 FROM conversations WHERE id = %s AND user_id = %s) "
                "RETURNING id",
                (
                    conversation_id,
                    role,
                    masked,
                    is_risk,
                    risk_layer,
                    intent,
                    reply_source,
                    json.dumps(meta or {}, ensure_ascii=False),
                    conversation_id,
                    user_id,
                ),
            )
            row = cursor.fetchone()
        conn.commit()
    return row[0] if row else None


def list_conversations(user_id: int, limit: int = None) -> "list[dict]":
    limit = limit or config.HISTORY_MAX_CONVERSATIONS
    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT c.id, c.started_at, c.title, count(m.id), "
                "       coalesce(bool_or(m.is_risk), false) "
                "FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id "
                "WHERE c.user_id = %s "
                "GROUP BY c.id ORDER BY c.started_at DESC LIMIT %s",
                (user_id, limit),
            )
            rows = cursor.fetchall()
    return [
        {
            "id": row[0],
            "started_at": row[1],
            "title": row[2],
            "messages": row[3],
            "has_risk": row[4],
        }
        for row in rows
    ]


def load_messages(user_id: int, conversation_id: int, limit: int = None) -> "list[dict]":
    limit = limit or config.HISTORY_MAX_MESSAGES
    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT m.role, m.content, m.created_at, m.is_risk, m.risk_layer, "
                "       m.intent, m.reply_source, m.meta "
                "FROM messages m JOIN conversations c ON c.id = m.conversation_id "
                "WHERE m.conversation_id = %s AND c.user_id = %s "
                "ORDER BY m.id LIMIT %s",
                (conversation_id, user_id, limit),
            )
            rows = cursor.fetchall()
    return [
        {
            "role": row[0],
            "content": row[1],
            "created_at": row[2],
            "is_risk": row[3],
            "risk_layer": row[4],
            "intent": row[5],
            "reply_source": row[6],
            "meta": row[7] or {},
        }
        for row in rows
    ]


def delete_conversation(user_id: int, conversation_id: int) -> int:
    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM conversations WHERE id = %s AND user_id = %s",
                (conversation_id, user_id),
            )
            deleted = cursor.rowcount
        conn.commit()
    return deleted


def delete_all_history(user_id: int) -> int:
    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM conversations WHERE user_id = %s", (user_id,))
            deleted = cursor.rowcount
        conn.commit()
    return deleted


def build_user_meta(risk_outcome: dict, intent_decision: dict) -> dict:
    """Gom ly do danh gia nguy co va hai nguon nhan y dinh."""
    meta = {}

    risk_outcome = risk_outcome or {}
    risk = {
        "risk": bool(risk_outcome.get("risk")),
        "layer": risk_outcome.get("layer"),
        "confidence": risk_outcome.get("confidence"),
    }
    signals = risk_outcome.get("signals")
    if signals:
        risk["signals"] = list(signals)[:5]
    knn = risk_outcome.get("knn")
    if knn:
        risk["knn"] = {
            "nearest_id": knn.get("nearest_id"),
            "nearest_label": knn.get("nearest_label"),
            "score": knn.get("score"),
            "votes": knn.get("votes"),
            "threshold": knn.get("threshold"),
        }
    if risk_outcome.get("error"):
        risk["error"] = str(risk_outcome["error"])[:200]
    meta["risk"] = risk

    if intent_decision:
        meta["intent"] = {
            "final": intent_decision.get("intent"),
            "llm": intent_decision.get("llm_intent"),
            "knn": intent_decision.get("knn_intent"),
            "knn_score": intent_decision.get("knn_score"),
            "agreed": intent_decision.get("agreed"),
            "policy": intent_decision.get("policy"),
        }
    return meta


def build_assistant_meta(retrieval: dict, reply_source: str) -> dict:
    """Ghi lai cau tra loi lay tu dau: doan nao cua tai lieu WHO, trang nao."""
    meta = {"reply_source": reply_source}
    if not retrieval:
        return meta

    meta["rag"] = {
        "source": retrieval.get("source"),
        "in_scope": retrieval.get("in_scope"),
        "top_score": retrieval.get("top_score"),
        "threshold": config.RAG_SIMILARITY_THRESHOLD,
        "hits": [
            {
                "skill": hit.get("skill"),
                "pages": hit.get("pages"),
                "kind": hit.get("kind"),
                "score": hit.get("score"),
            }
            for hit in (retrieval.get("hits") or [])
        ],
    }
    if retrieval.get("error"):
        meta["rag"]["error"] = str(retrieval["error"])[:200]
    return meta
