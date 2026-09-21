import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import streamlit as st

import assessment
import auth
import chat_pipeline
import config
import db
import guardrails
import llm
import rag_engine
import storage

logger = logging.getLogger(__name__)

STAGE_DISCLAIMER = "disclaimer"
STAGE_CHAT = "chat"
STAGE_ASSESSMENT = "assessment"
STAGE_RESULT = "result"

CHAT_INPUT_KEY = "chat_input"
RESET_FLAG_KEY = "_reset_requested"
RADIO_KEY_TEMPLATE = "pss10_radio_{item}"
TEXT_KEY_TEMPLATE = "pss10_text_{item}"

SUBSTAGE_INPUT = "input"
SUBSTAGE_CONFIRM = "confirm"


def init_session() -> None:
    defaults = {
        "stage": STAGE_DISCLAIMER,
        "messages": [],
        "risk_triggered": False,
        "consent_pending": False,
        "consent_asked": False,
        "user_turns": 0,
        "pss10_result": None,
        "reply_source": None,
        "last_retrieval": None,
        "last_intent": None,
        "last_intent_decision": None,
        "last_risk": None,
        "auth_user": None,
        "auth_error": "",
        "conversation_id": None,
        "storage_error": "",
        "viewing_conversation": None,
        "pss10_substage": SUBSTAGE_INPUT,
        "pss10_raw_text": "",
        "pss10_suggested": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value
    assessment.init_state(st.session_state)


def current_user():
    return st.session_state.get("auth_user")


def storage_ready() -> bool:
    """Chi luu khi da dang nhap VA da dong y, va DB dung duoc."""
    user = current_user()
    return bool(user and user.get("consent_at") and db.is_configured())


def persist_turn(user_text, risk_outcome, intent_decision, reply, reply_source, retrieval):
    if not storage_ready():
        logger.info("chat history persistence skipped reason=no_consent_or_guest")
        return

    user = current_user()
    try:
        conversation_id = storage.save_turn(
            user_id=user["id"],
            conversation_id=st.session_state.get("conversation_id"),
            user_text=user_text,
            assistant_text=reply or "",
            user_meta=storage.build_user_meta(risk_outcome, intent_decision),
            assistant_meta=storage.build_assistant_meta(retrieval, reply_source),
            is_risk=bool((risk_outcome or {}).get("risk")),
            risk_layer=(risk_outcome or {}).get("layer"),
            intent=(intent_decision or {}).get("intent"),
            reply_source=reply_source,
        )
        st.session_state.conversation_id = conversation_id
        st.session_state.storage_error = ""
        logger.info("chat turn saved user_id=%s conversation_id=%s", user["id"], conversation_id)
    except Exception:
        logger.exception("chat history persistence failed user_id=%s", user["id"])
        st.session_state.storage_error = "Lịch sử chưa lưu được. Bạn có thể thử lại sau."


def add_message(role: str, content: str) -> None:
    st.session_state.messages.append({"role": role, "content": content})


def run_guardrails(text: str) -> bool:
    outcome = chat_pipeline.assess_risk(text)
    st.session_state.last_risk = outcome

    if outcome["risk"]:
        st.session_state.risk_triggered = True
        st.session_state.consent_pending = False
    return bool(outcome["risk"])


def handle_user_text(text: str) -> None:
    text = (text or "").strip()
    if not text:
        return

    started = time.perf_counter()
    user = current_user()
    logger.info(
        "chat submit started user_id=%s chars=%d history_messages=%d",
        user.get("id") if user else None,
        len(text),
        len(st.session_state.messages),
    )
    add_message("user", text)
    st.session_state.user_turns += 1
    try:
        risk_detected = run_guardrails(text)
    except Exception:
        logger.exception("chat processing stopped because safety assessment failed")
        add_message("assistant", "Joy chưa thể kiểm tra an toàn cho tin nhắn này. Bạn thử lại sau nhé.")
        logger.info("chat submit finished route=safety_error elapsed_ms=%.1f", (time.perf_counter() - started) * 1000)
        return

    if risk_detected:
        persist_turn(
            text,
            st.session_state.get("last_risk"),
            None,
            config.CRISIS_BLOCK_PLACEHOLDER_VI,
            "crisis_block",
            None,
        )
        logger.info("chat submit finished route=crisis elapsed_ms=%.1f", (time.perf_counter() - started) * 1000)
        return

    if st.session_state.stage == STAGE_ASSESSMENT:
        add_message(
            "assistant",
            "Mình đang hỏi bạn bộ 10 câu. Bạn trả lời ở khối phía trên nhé, "
            'hoặc bấm "{stop}" nếu muốn dừng.'.format(
                stop=config.ASSESSMENT_STOP_LABEL
            ),
        )
        logger.info("chat submit finished route=assessment elapsed_ms=%.1f", (time.perf_counter() - started) * 1000)
        return

    if st.session_state.consent_pending:
        lowered = text.casefold()
        if any(word in lowered for word in ("không", "thôi", "chưa", "để sau")):
            decline_assessment()
            logger.info("chat submit finished route=assessment_declined elapsed_ms=%.1f", (time.perf_counter() - started) * 1000)
            return
        if any(word in lowered for word in ("có", "ok", "đồng ý", "thử", "được")):
            start_assessment()
            logger.info("chat submit finished route=assessment_started elapsed_ms=%.1f", (time.perf_counter() - started) * 1000)
            return

    history = st.session_state.messages[:-1]
    try:
        result = chat_pipeline.generate_reply(text, history, include_citation=True)
        content = result["reply"]
        source = result["reply_source"]
        st.session_state.last_intent = result["intent"]
        st.session_state.last_retrieval = result["retrieval"]
        decision = result["intent_decision"]
    except Exception:
        logger.exception("chat processing failed during intent or response generation")
        content = "Joy chưa tạo được phản hồi lúc này. Bạn thử gửi lại sau nhé."
        source = "error"
        st.session_state.last_intent = None
        st.session_state.last_retrieval = None
        decision = None
    st.session_state.last_intent_decision = decision

    st.session_state.reply_source = source
    add_message("assistant", content)

    persist_turn(
        text,
        st.session_state.get("last_risk"),
        decision,
        content,
        source,
        st.session_state.get("last_retrieval"),
    )

    if source != "error":
        maybe_offer_assessment(text)
    logger.info(
        "chat submit finished intent=%s source=%s elapsed_ms=%.1f",
        st.session_state.last_intent,
        source,
        (time.perf_counter() - started) * 1000,
    )


def answer_from_documents(question: str, history) -> "tuple[str, str]":
    content, source, outcome = chat_pipeline.answer_from_documents(
        question, history, include_citation=True
    )
    st.session_state.last_retrieval = outcome
    return content, source


def format_citation(outcome: dict) -> str:
    return chat_pipeline.format_citation(outcome)


def maybe_offer_assessment(text: str) -> None:
    if st.session_state.consent_asked or st.session_state.consent_pending:
        return

    lowered = (text or "").casefold()
    triggered_by_keyword = any(
        keyword in lowered for keyword in config.ASSESSMENT_TRIGGER_KEYWORDS
    )
    enough_turns = (
        st.session_state.user_turns >= config.TURNS_BEFORE_OFFERING_ASSESSMENT
    )
    if not (triggered_by_keyword or enough_turns):
        return

    st.session_state.consent_pending = True
    st.session_state.consent_asked = True
    add_message("assistant", config.CONSENT_PROMPT_VI)


def reset_item_substage() -> None:
    st.session_state.pss10_substage = SUBSTAGE_INPUT
    st.session_state.pss10_raw_text = ""
    st.session_state.pss10_suggested = None
    for item_id in range(1, config.PSS10_NUM_ITEMS + 1):
        st.session_state.pop(RADIO_KEY_TEMPLATE.format(item=item_id), None)
        st.session_state.pop(TEXT_KEY_TEMPLATE.format(item=item_id), None)


def start_assessment() -> None:
    st.session_state.consent_pending = False
    st.session_state.pss10_result = None
    assessment.reset_state(st.session_state)
    reset_item_substage()
    st.session_state.stage = STAGE_ASSESSMENT
    add_message(
        "assistant",
        "Cảm ơn bạn. Mình sẽ hỏi lần lượt 10 câu. Mỗi câu bạn trả lời bằng lời "
        "của mình, mình sẽ hiểu và tick sẵn một mức, rồi bạn xác nhận hoặc sửa "
        'lại. Muốn dừng lúc nào cũng được, bấm "{stop}".'.format(
            stop=config.ASSESSMENT_STOP_LABEL
        ),
    )


def decline_assessment() -> None:
    st.session_state.consent_pending = False
    add_message("assistant", config.CONSENT_DECLINED_VI)


def stop_assessment() -> None:
    assessment.reset_state(st.session_state)
    reset_item_substage()
    st.session_state.stage = STAGE_CHAT
    st.session_state.pss10_result = None
    add_message("assistant", config.ASSESSMENT_STOPPED_VI)


def cb_accept_disclaimer() -> None:
    st.session_state.stage = STAGE_CHAT
    add_message("assistant", config.GREETING_VI)


def cb_submit_chat() -> None:
    handle_user_text(st.session_state.get(CHAT_INPUT_KEY, ""))


def cb_consent_yes() -> None:
    start_assessment()


def cb_consent_no() -> None:
    decline_assessment()


def cb_submit_free_text(item_id: int, question_text: str, options: "list[str]") -> None:
    raw_text = str(st.session_state.get(TEXT_KEY_TEMPLATE.format(item=item_id), "")).strip()

    if raw_text and run_guardrails(raw_text):
        add_message("user", raw_text)
        return

    st.session_state.pss10_raw_text = raw_text
    if raw_text:
        suggested = llm.map_answer_to_likert(question_text, options, raw_text)
    else:
        suggested = None
    st.session_state.pss10_suggested = suggested

    radio_key = RADIO_KEY_TEMPLATE.format(item=item_id)
    if suggested is None:
        st.session_state.pop(radio_key, None)
    else:
        st.session_state[radio_key] = options[suggested]

    st.session_state.pss10_substage = SUBSTAGE_CONFIRM


def cb_redo_free_text(item_id: int) -> None:
    st.session_state.pss10_substage = SUBSTAGE_INPUT
    st.session_state.pss10_raw_text = ""
    st.session_state.pss10_suggested = None
    st.session_state.pop(RADIO_KEY_TEMPLATE.format(item=item_id), None)
    st.session_state.pop(TEXT_KEY_TEMPLATE.format(item=item_id), None)


def cb_confirm_answer(item_id: int, options: "list[str]") -> None:
    choice = st.session_state.get(RADIO_KEY_TEMPLATE.format(item=item_id))
    if choice is None:
        return

    confirmed = options.index(choice)

    assessment.record_answer(st.session_state, confirmed)

    st.session_state.pss10_substage = SUBSTAGE_INPUT
    st.session_state.pss10_raw_text = ""
    st.session_state.pss10_suggested = None

    if assessment.is_complete(st.session_state):
        st.session_state.pss10_result = assessment.score(
            assessment.answers(st.session_state)
        )
        st.session_state.stage = STAGE_RESULT


def cb_stop_assessment() -> None:
    stop_assessment()


def cb_back_to_chat() -> None:
    st.session_state.stage = STAGE_CHAT
    add_message(
        "assistant",
        "Mình vẫn ở đây. Bạn muốn kể thêm về điều gì đang làm bạn mệt không?",
    )


def cb_restart_assessment() -> None:
    start_assessment()


def cb_ack_crisis() -> None:
    st.session_state.risk_triggered = False
    add_message(
        "assistant",
        "Cảm ơn bạn đã đọc. Mình vẫn ở đây với bạn. Nếu bất cứ lúc nào bạn "
        "thấy không ổn, hãy gọi ngay các số phía trên nhé.",
    )


def cb_request_reset() -> None:
    st.session_state[RESET_FLAG_KEY] = True


def apply_pending_reset() -> None:
    if not st.session_state.get(RESET_FLAG_KEY):
        return
    for key in list(st.session_state.keys()):
        del st.session_state[key]


def render_crisis_block(reason: str = "risk") -> None:
    payload = guardrails.load_crisis_resources()

    if reason == "risk":
        st.error(payload.get("intro_vi", ""), icon="🆘")
    else:
        st.warning(
            "Mức căng thẳng của bạn đang cao. Mình để lại các kênh hỗ trợ ở "
            "đây để khi cần bạn có ngay - không phải vì mình nghĩ bạn đang "
            "gặp nguy hiểm.",
            icon="📞",
        )

    for item in payload["resources"]:
        with st.container(border=True):
            st.markdown(
                "### {name}\n"
                "**Điện thoại: {phone}**  \n"
                "🕒 Giờ hoạt động: {hours}".format(
                    name=item.get("name", ""),
                    phone=item.get("phone", ""),
                    hours=item.get("hours", "chưa rõ"),
                )
            )
            note = item.get("note")
            if note:
                st.caption(note)

    closing = payload.get("closing_vi")
    if closing:
        st.markdown("**{closing}**".format(closing=closing))


def render_disclaimer() -> None:
    st.markdown(config.DISCLAIMER_VI)
    st.divider()
    st.button(
        config.DISCLAIMER_ACK_LABEL, type="primary", on_click=cb_accept_disclaimer
    )


def cb_logout() -> None:
    st.session_state.auth_user = None
    st.session_state.conversation_id = None
    st.session_state.viewing_conversation = None
    st.session_state.auth_error = ""


def do_login(username: str, password: str) -> None:
    try:
        db.init_schema()
        st.session_state.auth_user = auth.authenticate(username, password)
        st.session_state.auth_error = ""
        st.session_state.conversation_id = None
    except auth.AuthError as error:
        st.session_state.auth_error = str(error)
    except Exception:
        logger.exception("account login failed")
        st.session_state.auth_error = "Dịch vụ tài khoản tạm thời chưa khả dụng. Bạn thử lại sau nhé."


def do_register(username: str, password: str, confirm: str) -> None:
    problem = auth.validate_username(username) or auth.validate_password(password, confirm)
    if problem:
        st.session_state.auth_error = problem
        return
    try:
        db.init_schema()
        st.session_state.auth_user = auth.create_user(username, password)
        st.session_state.auth_error = ""
        st.session_state.conversation_id = None
    except auth.AuthError as error:
        st.session_state.auth_error = str(error)
    except Exception:
        logger.exception("account registration failed")
        st.session_state.auth_error = "Dịch vụ tài khoản tạm thời chưa khả dụng. Bạn thử lại sau nhé."


def cb_accept_storage_consent() -> None:
    user = current_user()
    if not user:
        return
    try:
        auth.record_consent(user["id"])
        st.session_state.auth_user = auth.get_user(user["id"])
    except Exception:
        logger.exception("storage consent update failed user_id=%s", user["id"])
        st.session_state.auth_error = "Không thể cập nhật lựa chọn lưu lịch sử. Bạn thử lại sau nhé."


def cb_delete_all_history() -> None:
    user = current_user()
    if not user:
        return
    try:
        storage.delete_all_history(user["id"])
        st.session_state.conversation_id = None
        st.session_state.viewing_conversation = None
        logger.info("chat history deleted user_id=%s", user["id"])
    except Exception:
        logger.exception("chat history deletion failed user_id=%s", user["id"])
        st.session_state.storage_error = "Chưa xoá được lịch sử. Bạn thử lại sau nhé."


def cb_delete_account() -> None:
    user = current_user()
    if not user:
        return
    try:
        auth.delete_user(user["id"])
        logger.info("account deleted user_id=%s", user["id"])
        cb_logout()
    except Exception:
        logger.exception("account deletion failed user_id=%s", user["id"])
        st.session_state.auth_error = "Chưa xoá được tài khoản. Bạn thử lại sau nhé."


def cb_view_conversation(conversation_id: int) -> None:
    st.session_state.viewing_conversation = conversation_id


def cb_close_history() -> None:
    st.session_state.viewing_conversation = None


def render_login_forms() -> None:
    st.caption("Bạn đang dùng ở chế độ khách. Không có gì được lưu lại.")
    tab_login, tab_register = st.tabs(["Đăng nhập", "Đăng ký"])

    with tab_login:
        with st.form("form_login", clear_on_submit=False):
            username = st.text_input("Tên đăng nhập")
            password = st.text_input("Mật khẩu", type="password")
            if st.form_submit_button("Đăng nhập"):
                do_login(username, password)

    with tab_register:
        with st.form("form_register", clear_on_submit=False):
            new_username = st.text_input("Tên đăng nhập mới")
            new_password = st.text_input("Mật khẩu", type="password")
            confirm = st.text_input("Nhập lại mật khẩu", type="password")
            if st.form_submit_button("Tạo tài khoản"):
                do_register(new_username, new_password, confirm)

    if st.session_state.get("auth_error"):
        st.error(st.session_state.auth_error, icon="⚠️")


def render_storage_consent() -> None:
    st.warning(config.CONSENT_STORAGE_TITLE_VI, icon="💾")
    st.caption(config.CONSENT_STORAGE_BODY_VI)
    st.button("Đồng ý lưu lịch sử", on_click=cb_accept_storage_consent)
    st.caption("Chưa đồng ý nên hiện tại các lượt trò chuyện không được lưu.")


def render_history_sidebar() -> None:
    user = current_user()
    try:
        conversations = storage.list_conversations(user["id"])
    except Exception:
        logger.exception("chat history list failed user_id=%s", user["id"])
        st.error("Chưa đọc được lịch sử. Bạn thử lại sau nhé.", icon="⚠️")
        return

    st.caption("Lịch sử trò chuyện ({0} phiên gần nhất)".format(len(conversations)))
    if not conversations:
        st.caption("Chưa có phiên nào được lưu.")
    for item in conversations:
        label = "{0} · {1} tin nhắn{2}".format(
            item["started_at"].strftime("%d/%m %H:%M"),
            item["messages"],
            " · ⚠️" if item["has_risk"] else "",
        )
        st.button(
            label,
            key="history_open_{0}".format(item["id"]),
            on_click=cb_view_conversation,
            args=(item["id"],),
            use_container_width=True,
        )

    with st.expander("Xoá dữ liệu của tôi"):
        st.caption("Thao tác xoá là vĩnh viễn, không khôi phục được.")
        st.button("Xoá toàn bộ lịch sử", on_click=cb_delete_all_history)
        st.button("Xoá tài khoản và toàn bộ dữ liệu", on_click=cb_delete_account)


def render_auth_sidebar() -> None:
    st.divider()
    if not db.is_configured():
        st.caption(
            "Chế độ khách: chưa cấu hình {0} nên không có đăng nhập và không lưu "
            "lịch sử.".format(config.DATABASE_URL_ENV)
        )
        return

    user = current_user()
    if not user:
        render_login_forms()
        return

    st.success("Đang đăng nhập: {0}".format(user["username"]), icon="👤")
    st.button("Đăng xuất", on_click=cb_logout)

    if st.session_state.get("auth_error"):
        st.error(st.session_state.auth_error, icon="⚠️")

    if not user.get("consent_at"):
        render_storage_consent()
        return

    if st.session_state.get("storage_error"):
        st.error("Lỗi lưu lịch sử: " + st.session_state.storage_error, icon="⚠️")
    render_history_sidebar()


def render_history_view(conversation_id: int) -> None:
    user = current_user()
    st.subheader("Xem lại một phiên đã lưu")
    st.button("Quay lại trò chuyện", on_click=cb_close_history)

    try:
        messages = storage.load_messages(user["id"], conversation_id)
    except Exception:
        logger.exception(
            "chat history detail failed user_id=%s conversation_id=%s",
            user["id"],
            conversation_id,
        )
        st.error("Chưa đọc được phiên trò chuyện. Bạn thử lại sau nhé.", icon="⚠️")
        return

    if not messages:
        st.info("Phiên này không còn tin nhắn nào.")
        return

    for item in messages:
        with st.chat_message(item["role"]):
            st.markdown(item["content"])


def render_sidebar() -> None:
    with st.sidebar:
        st.subheader(config.APP_TITLE)
        st.caption(
            "Lịch sử được lưu khi bạn đăng nhập và đồng ý lưu. Ở chế độ khách, "
            "hội thoại chỉ tồn tại trong phiên làm việc này."
        )
        st.button("Xóa phiên và bắt đầu lại", on_click=cb_request_reset)

        render_auth_sidebar()

def render_messages() -> None:
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])


def render_consent_buttons() -> None:
    left, right = st.columns(2)
    with left:
        st.button(
            config.CONSENT_YES_LABEL,
            type="primary",
            use_container_width=True,
            on_click=cb_consent_yes,
        )
    with right:
        st.button(
            config.CONSENT_NO_LABEL,
            use_container_width=True,
            on_click=cb_consent_no,
        )


def render_assessment() -> None:
    question = assessment.current_question(st.session_state)
    answered, total = assessment.progress(st.session_state)
    item_id = question["item_id"]
    radio_key = RADIO_KEY_TEMPLATE.format(item=item_id)
    text_key = TEXT_KEY_TEMPLATE.format(item=item_id)

    with st.container(border=True):
        st.progress(
            answered / total,
            text="Đã trả lời {a}/{t} câu".format(a=answered, t=total),
        )
        st.markdown(
            "**Câu {item}/{total}.** {text}".format(
                item=item_id, total=total, text=question["text_vi"]
            )
        )

        if st.session_state.pss10_substage == SUBSTAGE_INPUT:
            st.text_area(
                "Bạn cứ trả lời bằng lời của mình",
                key=text_key,
                placeholder=config.MAPPING_ANSWER_PLACEHOLDER_VI,
                height=90,
            )
            left, right = st.columns([2, 1])
            with left:
                st.button(
                    config.MAPPING_SUBMIT_LABEL,
                    type="primary",
                    use_container_width=True,
                    on_click=cb_submit_free_text,
                    args=(item_id, question["text_vi"], question["options"]),
                )
            with right:
                st.button(
                    config.ASSESSMENT_STOP_LABEL,
                    use_container_width=True,
                    on_click=cb_stop_assessment,
                )
            st.caption(
                "Hoặc bạn có thể bỏ trống rồi bấm gửi để tự chọn mức trong danh "
                "sách 5 phương án."
            )
        else:
            raw_text = st.session_state.pss10_raw_text or ""
            suggested = st.session_state.pss10_suggested

            if raw_text:
                st.markdown("> Bạn trả lời: _{0}_".format(raw_text))

            if suggested is None:
                st.info(config.MAPPING_NO_SUGGESTION_NOTE_VI, icon="✋")
            else:
                st.info(
                    config.MAPPING_SUGGESTION_NOTE_VI.format(
                        option=question["options"][suggested]
                    ),
                    icon="✅",
                )

            choice = st.radio(
                "Mức bạn xác nhận",
                options=question["options"],
                index=None,
                key=radio_key,
            )

            left, middle, right = st.columns([2, 2, 1])
            with left:
                st.button(
                    config.MAPPING_CONFIRM_LABEL,
                    type="primary",
                    disabled=choice is None,
                    use_container_width=True,
                    on_click=cb_confirm_answer,
                    args=(item_id, question["options"]),
                )
            with middle:
                st.button(
                    config.MAPPING_REDO_LABEL,
                    use_container_width=True,
                    on_click=cb_redo_free_text,
                    args=(item_id,),
                )
            with right:
                st.button(
                    config.ASSESSMENT_STOP_LABEL,
                    use_container_width=True,
                    on_click=cb_stop_assessment,
                )

    st.caption(
        "Bạn có thể dừng bất cứ lúc nào. Kết quả chỉ để tham khảo, không phải "
        "chẩn đoán."
    )


def render_result() -> None:
    total, level = st.session_state.pss10_result

    with st.container(border=True):
        st.subheader("Kết quả PSS-10")
        left, right = st.columns(2)
        left.metric(
            "Tổng điểm",
            "{total}/{maximum}".format(total=total, maximum=config.PSS10_SCORE_MAX),
        )
        right.metric("Mức độ", config.LEVEL_TITLES_VI[level])
        st.write(config.LEVEL_EXPLANATION_VI[level])
        st.caption(
            "Thang PSS-10 (Cohen, 1983). Item {items} được đảo điểm trước khi "
            "cộng. Ngưỡng: {ranges}.".format(
                items=", ".join(str(i) for i in config.REVERSE_ITEMS),
                ranges="; ".join(
                    "{lo}-{hi} = {name}".format(lo=lo, hi=hi, name=config.LEVEL_TITLES_VI[name])
                    for lo, hi, name in config.PSS10_LEVELS
                ),
            )
        )

    st.subheader("Kỹ năng gợi ý cho bạn")
    try:
        summaries = rag_engine.skill_summaries(config.LEVEL_TO_SKILLS[level])
    except Exception:
        logger.exception("assessment recommendation retrieval failed skills=%s", config.LEVEL_TO_SKILLS[level])
        summaries = []

    if not summaries:
        st.error(config.PSS10_SKILLS_UNAVAILABLE_VI, icon="⚠️")

    for entry in summaries:
        with st.container(border=True):
            st.markdown("#### " + entry["title"])
            st.write(entry["body"])
            if entry["pages"]:
                st.caption(
                    "{prefix}, trang {pages}".format(
                        prefix=config.RAG_CITATION_PREFIX_VI, pages=entry["pages"]
                    )
                )

    if level in config.LEVELS_SHOWING_SUPPORT_BLOCK:
        st.divider()
        st.markdown(
            "Với mức căng thẳng này, mình rất mong bạn cân nhắc nói chuyện với "
            "một nhà tâm lý hoặc bác sĩ chuyên khoa. Tìm hỗ trợ không phải là "
            "yếu, đó là một cách chăm sóc bản thân."
        )
        render_crisis_block(reason="high_level")

    st.divider()
    left, right = st.columns(2)
    with left:
        st.button(
            "Quay lại trò chuyện", use_container_width=True, on_click=cb_back_to_chat
        )
    with right:
        st.button(
            "Làm lại bài đánh giá",
            use_container_width=True,
            on_click=cb_restart_assessment,
        )


def main() -> None:
    st.set_page_config(page_title=config.APP_TITLE, page_icon="📓")
    apply_pending_reset()
    init_session()

    st.title(config.APP_TITLE)
    st.caption(config.APP_TAGLINE)

    if st.session_state.stage == STAGE_DISCLAIMER:
        render_disclaimer()
        return

    render_sidebar()

    if st.session_state.get("viewing_conversation"):
        render_history_view(st.session_state.viewing_conversation)
        return

    if st.session_state.risk_triggered:
        render_messages()
        render_crisis_block(reason="risk")
        st.divider()
        st.button(
            "Mình đã xem các kênh hỗ trợ, muốn trò chuyện tiếp",
            on_click=cb_ack_crisis,
        )
        return

    render_messages()

    if st.session_state.stage == STAGE_ASSESSMENT:
        render_assessment()
    elif st.session_state.stage == STAGE_RESULT:
        render_result()
    elif st.session_state.consent_pending:
        render_consent_buttons()

    st.chat_input(
        "Bạn đang cảm thấy thế nào?", key=CHAT_INPUT_KEY, on_submit=cb_submit_chat
    )


if __name__ == "__main__":
    main()
