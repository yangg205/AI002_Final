import json
import logging
import os
import re

from dotenv import load_dotenv

import config
import masking

__all__ = [
    "is_available",
    "reply",
    "scripted_reply",
    "last_error",
    "complete",
    "classify_intent",
    "last_intent_error",
    "answer_with_context",
    "parse_json_object",
    "map_answer_to_likert",
    "last_mapping_error",
    "last_mapping_status",
    "MAPPING_STATUS_OK",
    "MAPPING_STATUS_REFUSED",
    "MAPPING_STATUS_INVALID",
    "MAPPING_STATUS_ERROR",
]

load_dotenv(dotenv_path=config.PROJECT_ROOT / ".env")

_last_error = None
_LOGGER = logging.getLogger(__name__)


def last_error():
    return _last_error


def _api_key():
    key = os.getenv(config.GROQ_API_KEY_ENV, "").strip()
    return key or None


def is_available() -> bool:
    if not _api_key():
        return False
    try:
        import openai
    except ImportError:
        return False
    return True


def scripted_reply(user_text: str) -> str:
    text = (user_text or "").casefold()
    for keywords, response in config.SCRIPTED_REPLIES_VI:
        for keyword in keywords:
            if keyword in text:
                return response
    return config.SCRIPTED_REPLY_DEFAULT_VI


def _build_messages(user_text: str, history) -> "list[dict]":
    messages = [{"role": "system", "content": config.LLM_SYSTEM_PROMPT_VI}]
    recent = list(history or [])[-config.LLM_HISTORY_TURNS :]
    for entry in recent:
        role = entry.get("role")
        content = entry.get("content", "")
        if role == "user" and content:
            content = masking.mask_text(content)
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": masking.mask_text(user_text)})
    return messages


def client():
    from openai import OpenAI

    key = _api_key()
    if not key:
        raise RuntimeError(
            "Thieu {env} trong .env".format(env=config.GROQ_API_KEY_ENV)
        )
    return OpenAI(
        api_key=key,
        base_url=config.GROQ_BASE_URL,
        timeout=config.LLM_TIMEOUT_SECONDS,
    )


_SENTENCE_END_RE = re.compile(r"(?s)^.*[.!?…:)\]\"”』]\s")


def _trim_unfinished(text: str) -> str:
    """Cat bo cau dang do khi model bi dung vi het han muc token.

    Tha tra ve it hon con hon de nguoi dung doc mot cau cut giua chung.
    """
    text = (text or "").rstrip()
    if not text:
        return text

    lines = text.split("\n")
    if len(lines) > 1 and not _SENTENCE_END_RE.match(lines[-1] + " "):
        trimmed = "\n".join(lines[:-1]).rstrip()
        if trimmed:
            return trimmed

    match = _SENTENCE_END_RE.match(text + " ")
    if match:
        return match.group(0).rstrip()
    return text


def complete(
    messages, temperature=None, max_tokens=None, response_format=None, model=None
) -> str:
    kwargs = {
        "model": model or config.GROQ_MODEL,
        "messages": messages,
        "temperature": config.LLM_TEMPERATURE if temperature is None else temperature,
        "max_tokens": config.LLM_MAX_TOKENS if max_tokens is None else max_tokens,
        "seed": config.LLM_SEED,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format
    if config.LLM_REASONING_EFFORT and response_format is None:
        kwargs["reasoning_effort"] = config.LLM_REASONING_EFFORT

    completion = client().chat.completions.create(**kwargs)
    choice = completion.choices[0]
    content = (choice.message.content or "").strip()
    if not content:
        raise ValueError("LLM trả về nội dung rỗng.")

    if choice.finish_reason == "length" and response_format is None:
        content = _trim_unfinished(content)
    return content


def reply(user_text: str, history=None) -> "tuple[str, str]":
    global _last_error

    if not is_available():
        return scripted_reply(user_text), "scripted"

    try:
        content = complete(_build_messages(user_text, history))
        _last_error = None
        return content, "llm"
    except Exception as error:
        _last_error = "{name}: {msg}".format(name=type(error).__name__, msg=error)
        _LOGGER.exception("LLM response generation failed; using scripted fallback")
        return scripted_reply(user_text), "scripted"


_last_intent_error = None


def last_intent_error():
    return _last_intent_error


def parse_json_object(raw: str) -> dict:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()

    try:
        payload = json.loads(text)
    except ValueError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("Khong tim thay JSON object trong output LLM")
        payload = json.loads(match.group(0))

    if not isinstance(payload, dict):
        raise ValueError("JSON tra ve khong phai object")
    return payload


def classify_intent(text: str) -> str:
    global _last_intent_error

    text = (text or "").strip()
    if not text:
        return config.INTENT_FALLBACK

    if not is_available():
        _last_intent_error = "Chua co {env}".format(env=config.GROQ_API_KEY_ENV)
        return config.INTENT_FALLBACK

    try:
        raw = complete(
            [
                {"role": "system", "content": config.INTENT_SYSTEM_PROMPT_VI},
                {"role": "user", "content": masking.mask_text(text)},
            ],
            temperature=config.INTENT_TEMPERATURE,
            max_tokens=config.INTENT_MAX_TOKENS,
            response_format={"type": "json_object"},
            model=config.GROQ_INTENT_MODEL,
        )
        label = str(parse_json_object(raw).get("intent", "")).strip().casefold()
        if label not in config.INTENT_LABELS:
            raise ValueError("Nhan khong hop le: {0!r}".format(label))
        _last_intent_error = None
        return label
    except Exception as error:
        _last_intent_error = "{name}: {msg}".format(
            name=type(error).__name__, msg=error
        )
        _LOGGER.exception("LLM intent classification failed; using fallback intent")
        return config.INTENT_FALLBACK


_last_mapping_error = None
_last_mapping_status = None

MAPPING_STATUS_OK = "ok"
MAPPING_STATUS_REFUSED = "refused"
MAPPING_STATUS_INVALID = "invalid"
MAPPING_STATUS_ERROR = "error"


def last_mapping_error():
    return _last_mapping_error


def last_mapping_status():
    return _last_mapping_status


def map_answer_to_likert(question_text: str, options, user_text: str):
    global _last_mapping_error, _last_mapping_status

    user_text = (user_text or "").strip()
    options = list(options or [])
    if not user_text or not options:
        _last_mapping_error = None
        _last_mapping_status = MAPPING_STATUS_REFUSED
        return None

    if not is_available():
        _last_mapping_error = "Chua co {env}".format(env=config.GROQ_API_KEY_ENV)
        _last_mapping_status = MAPPING_STATUS_ERROR
        return None

    option_lines = "\n".join(
        "{index} = {label}".format(index=index, label=label)
        for index, label in enumerate(options)
    )
    prompt = (
        "Câu hỏi PSS-10:\n{question}\n\n"
        "Năm mức được phép chọn:\n{options}\n\n"
        "Câu trả lời tự do của người dùng:\n{answer}".format(
            question=question_text,
            options=option_lines,
            answer=masking.mask_text(user_text),
        )
    )

    try:
        raw = complete(
            [
                {"role": "system", "content": config.MAPPING_SYSTEM_PROMPT_VI},
                {"role": "user", "content": prompt},
            ],
            temperature=config.MAPPING_TEMPERATURE,
            max_tokens=config.MAPPING_MAX_TOKENS,
            response_format={"type": "json_object"},
        )
        payload = parse_json_object(raw)
    except Exception as error:
        _last_mapping_error = "{name}: {msg}".format(
            name=type(error).__name__, msg=error
        )
        _last_mapping_status = MAPPING_STATUS_ERROR
        _LOGGER.exception("PSS answer mapping failed")
        return None

    score = payload.get("score", None)
    if score is None:
        _last_mapping_error = None
        _last_mapping_status = MAPPING_STATUS_REFUSED
        return None

    try:
        if isinstance(score, bool):
            raise ValueError("score la bool")
        score = int(score)
        if not config.LIKERT_MIN <= score <= config.LIKERT_MAX:
            raise ValueError("score ngoai khoang: {0}".format(score))
        if score >= len(options):
            raise ValueError("score vuot so phuong an: {0}".format(score))
    except Exception as error:
        _last_mapping_error = "{name}: {msg}".format(
            name=type(error).__name__, msg=error
        )
        _last_mapping_status = MAPPING_STATUS_INVALID
        return None

    _last_mapping_error = None
    _last_mapping_status = MAPPING_STATUS_OK
    return score


def _format_context(hits) -> str:
    parts = []
    for index, hit in enumerate(hits, start=1):
        pages = hit.get("pages") or []
        label = "trang " + ", ".join(str(p) for p in pages)
        parts.append(
            "[Đoạn {index} - {skill}, {label}]\n{text}".format(
                index=index,
                skill=config.SKILL_TITLES_VI.get(hit.get("skill"), hit.get("skill")),
                label=label,
                text=hit.get("text", ""),
            )
        )
    return "\n\n".join(parts)


def answer_with_context(question: str, hits, history=None) -> "tuple[str, str]":
    global _last_error

    if not hits:
        return config.RAG_OUT_OF_SCOPE_MESSAGE_VI, "extractive"

    context = _format_context(hits)
    if not is_available():
        return _extractive_answer(hits), "extractive"

    messages = [{"role": "system", "content": config.RAG_SYSTEM_PROMPT_VI}]
    for entry in list(history or [])[-config.LLM_HISTORY_TURNS :]:
        role = entry.get("role")
        content = entry.get("content")
        if role == "user" and content:
            content = masking.mask_text(content)
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append(
        {
            "role": "user",
            "content": "{header}\n\n{context}\n\nCâu hỏi của người dùng: {question}".format(
                header=config.RAG_CONTEXT_HEADER_VI,
                context=context,
                question=masking.mask_text(question),
            ),
        }
    )

    try:
        content = complete(messages)
        _last_error = None
        return content, "llm"
    except Exception as error:
        _last_error = "{name}: {msg}".format(name=type(error).__name__, msg=error)
        _LOGGER.exception("LLM grounded answer failed; using retrieved text fallback")
        return _extractive_answer(hits), "extractive"


def _extractive_answer(hits) -> str:
    best = hits[0]
    body = best.get("text", "").strip()
    return (
        "Mình chưa gọi được mô hình ngôn ngữ lúc này, nên mình gửi bạn nguyên "
        "văn phần tài liệu liên quan nhất:\n\n" + body
    )
