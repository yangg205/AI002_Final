import json
import re
import unicodedata
from functools import lru_cache

import config
import guardrails_keywords as kw
import text_normalize

__all__ = [
    "check_keyword",
    "check_risk_signal",
    "classify_risk",
    "assess_risk",
    "is_configured",
    "matched_signals",
    "load_crisis_resources",
    "crisis_message_lines",
]


_WHITESPACE_RE = re.compile(r"\s+", re.UNICODE)


def _normalize(text: str) -> str:
    if not isinstance(text, str):
        return ""
    normalized = unicodedata.normalize("NFC", text)
    normalized = normalized.casefold()
    return _WHITESPACE_RE.sub(" ", normalized).strip()


@lru_cache(maxsize=1)
def _normalized_keywords() -> tuple:
    return tuple(
        _normalize(item) for item in getattr(kw, "RISK_KEYWORDS", []) if _normalize(item)
    )


@lru_cache(maxsize=1)
def _normalized_exclusions() -> tuple:
    return tuple(
        _normalize(item)
        for item in getattr(kw, "RISK_EXCLUSION_PHRASES", [])
        if _normalize(item)
    )


@lru_cache(maxsize=1)
def _compiled_patterns() -> tuple:
    compiled = []
    for pattern in getattr(kw, "RISK_REGEX_PATTERNS", []):
        if not isinstance(pattern, str) or not pattern.strip():
            continue
        try:
            compiled.append(re.compile(pattern, re.IGNORECASE | re.UNICODE))
        except re.error:
            continue
    return tuple(compiled)


@lru_cache(maxsize=1)
def _nospace_keywords() -> tuple:
    return tuple(
        (keyword, text_normalize.strip_spaces(keyword))
        for keyword in _normalized_keywords()
    )


@lru_cache(maxsize=1)
def _strict_keywords() -> tuple:
    strict = []
    for keyword in _normalized_keywords():
        nodiacritic = text_normalize.strip_diacritics(keyword)
        if len(nodiacritic) < config.KEYWORD_STRICT_MIN_CHARS:
            continue
        strict.append((keyword, nodiacritic, text_normalize.strip_spaces(nodiacritic)))
    return tuple(strict)


@lru_cache(maxsize=8)
def _exclusions_for(variant: str) -> tuple:
    phrases = _normalized_exclusions()
    if variant == "v3_nospace":
        return tuple(text_normalize.strip_spaces(phrase) for phrase in phrases)
    if variant == "v4_nodiacritic":
        return tuple(text_normalize.strip_diacritics(phrase) for phrase in phrases)
    if variant == "v5_nodiacritic_nospace":
        return tuple(
            text_normalize.strip_spaces(text_normalize.strip_diacritics(phrase))
            for phrase in phrases
        )
    return phrases


def _keyword_pool(variant: str) -> tuple:
    if variant == "v3_nospace":
        return _nospace_keywords()
    if variant == "v4_nodiacritic":
        return tuple((keyword, nodiacritic) for keyword, nodiacritic, _ in _strict_keywords())
    if variant == "v5_nodiacritic_nospace":
        return tuple((keyword, nospace) for keyword, _, nospace in _strict_keywords())
    return tuple((keyword, keyword) for keyword in _normalized_keywords())


def is_configured() -> bool:
    return bool(_normalized_keywords() or _compiled_patterns())


def matched_signals(text: str, use_normalize: bool = None) -> "list[str]":
    normalized = _normalize(text)
    if not normalized:
        return []

    if use_normalize is None:
        use_normalize = config.NORMALIZE_ENABLED

    if use_normalize:
        variants = text_normalize.build_variants(normalized)
    else:
        variants = (("v0_base", normalized),)

    hits = []
    seen = set()
    for variant, value in variants:
        if any(phrase in value for phrase in _exclusions_for(variant)):
            continue

        for keyword, needle in _keyword_pool(variant):
            if needle and needle in value and keyword not in seen:
                seen.add(keyword)
                hits.append("keyword:" + keyword + "@" + variant)

        if variant in text_normalize.FULL_MATCH_VARIANTS:
            for pattern in _compiled_patterns():
                if pattern.search(value) and pattern.pattern not in seen:
                    seen.add(pattern.pattern)
                    hits.append("regex:" + pattern.pattern + "@" + variant)
    return hits


def check_keyword(text: str, use_normalize: bool = None) -> bool:
    return bool(matched_signals(text, use_normalize=use_normalize))


check_risk_signal = check_keyword


def classify_risk(text: str) -> dict:
    import llm

    text = (text or "").strip()
    if not text:
        return {"risk": False, "confidence": "high", "source": "empty", "error": None}

    try:
        raw = llm.complete(
            [
                {"role": "system", "content": config.RISK_SYSTEM_PROMPT_VI},
                {"role": "user", "content": text},
            ],
            temperature=config.RISK_TEMPERATURE,
            max_tokens=config.RISK_MAX_TOKENS,
            response_format={"type": "json_object"},
            model=config.GROQ_RISK_MODEL,
        )
        payload = llm.parse_json_object(raw)

        risk = payload.get("risk")
        if isinstance(risk, str):
            normalized = risk.strip().casefold()
            if normalized in {"true", "yes", "1", "co", "có"}:
                risk = True
            elif normalized in {"false", "no", "0", "khong", "không"}:
                risk = False
            else:
                raise ValueError("Truong 'risk' khong ro nghia: {0!r}".format(risk))
        if not isinstance(risk, bool):
            raise ValueError("Truong 'risk' khong phai bool: {0!r}".format(risk))

        confidence = str(payload.get("confidence", "")).strip().casefold()
        if confidence not in config.RISK_CONFIDENCE_LEVELS:
            confidence = "low"

        return {
            "risk": risk,
            "confidence": confidence,
            "source": "llm",
            "error": None,
        }
    except Exception as error:
        return {
            "risk": True,
            "confidence": "low",
            "source": "fail_safe",
            "error": "{name}: {msg}".format(name=type(error).__name__, msg=error),
        }


def _knn_vote(text: str, use_knn: bool):
    if use_knn is None:
        use_knn = config.KNN_ENABLED and config.KNN_RISK_ENABLED
    if not use_knn:
        return None

    import knn_router

    try:
        if not knn_router.is_ready("risk"):
            return None
    except Exception:
        return None
    return knn_router.risk_vote(text)


def assess_risk(text: str, use_layer2: bool = True, use_knn: bool = None) -> dict:
    signals = matched_signals(text)
    if signals:
        return {
            "risk": True,
            "layer": "keyword",
            "confidence": "high",
            "error": None,
            "signals": signals,
            "knn": None,
        }

    knn = _knn_vote(text, use_knn)
    if knn and knn["risk"]:
        return {
            "risk": True,
            "layer": "knn",
            "confidence": knn["confidence"],
            "error": None,
            "signals": [],
            "knn": knn,
        }

    if not use_layer2:
        return {
            "risk": False,
            "layer": None,
            "confidence": None,
            "error": None,
            "signals": [],
            "knn": knn,
        }

    outcome = classify_risk(text)
    return {
        "risk": bool(outcome["risk"]),
        "layer": "llm" if outcome["risk"] else None,
        "confidence": outcome["confidence"],
        "error": outcome["error"],
        "signals": [],
        "knn": knn,
    }


@lru_cache(maxsize=1)
def load_crisis_resources() -> dict:
    with open(config.CRISIS_RESOURCES_PATH, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not payload.get("resources"):
        raise ValueError(
            "crisis_resources.json không có kênh hỗ trợ nào - "
            "guardrails không thể hiển thị tài nguyên."
        )
    return payload


def crisis_message_lines() -> "list[str]":
    payload = load_crisis_resources()
    lines = [payload.get("intro_vi", "")]
    for item in payload["resources"]:
        lines.append(
            "{name}: {phone} (giờ hoạt động: {hours})".format(
                name=item.get("name", ""),
                phone=item.get("phone", ""),
                hours=item.get("hours", "chưa rõ giờ hoạt động"),
            )
        )
        note = item.get("note")
        if note:
            lines.append("    " + note)
    closing = payload.get("closing_vi")
    if closing:
        lines.append(closing)
    return [line for line in lines if line]

