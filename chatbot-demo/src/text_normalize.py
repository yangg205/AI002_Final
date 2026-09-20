"""Chuẩn hoá văn bản CHỈ dùng cho lớp từ khoá của guardrails.

Bản chuẩn hoá không bao giờ được gửi ra ngoài module guardrails: lớp 2
(classify_risk), classify_intent và RAG đều phải nhận văn bản gốc, vì chuẩn
hoá có thể làm sai nghĩa.
"""

import re
import unicodedata
from functools import lru_cache

import config

__all__ = [
    "strip_diacritics",
    "strip_spaces",
    "join_split_letters",
    "collapse_repeats",
    "collapse_doubles",
    "apply_leet",
    "apply_teencode",
    "normalize",
    "build_variants",
    "FULL_MATCH_VARIANTS",
    "STRICT_MATCH_VARIANTS",
]


FULL_MATCH_VARIANTS = ("v0_base", "v1_full", "v2_nodouble", "v3_nospace")
STRICT_MATCH_VARIANTS = ("v4_nodiacritic", "v5_nodiacritic_nospace")

_INVISIBLE_RE = re.compile("[­​-‏⁠‪-‮﻿]")
_WHITESPACE_RE = re.compile(r"\s+", re.UNICODE)
_COMBINING_RE = re.compile("[̀-ͯ]")
_DOUBLE_RE = re.compile(r"([^\W\d_])\1+", re.UNICODE)
_TOKEN_SPLIT_RE = re.compile(r"(\s+)", re.UNICODE)


@lru_cache(maxsize=1)
def _repeat_re():
    return re.compile(
        r"(.)\1{" + str(max(1, config.NORMALIZE_REPEAT_COLLAPSE_MIN - 1)) + r",}",
        re.UNICODE,
    )


@lru_cache(maxsize=1)
def _separator_re():
    return re.compile("[" + re.escape(config.JOIN_SEPARATORS) + "]+")


def strip_diacritics(text: str) -> str:
    if not text:
        return ""
    decomposed = unicodedata.normalize("NFD", text)
    stripped = _COMBINING_RE.sub("", decomposed)
    stripped = stripped.replace("đ", "d").replace("Đ", "D")
    return unicodedata.normalize("NFC", stripped)


def strip_spaces(text: str) -> str:
    return _WHITESPACE_RE.sub("", text or "")


def _join_token(token: str) -> str:
    if not any(char in config.JOIN_SEPARATORS for char in token):
        return token

    parts = _separator_re().split(token)
    if len(parts) < 2 or any(not part for part in parts):
        return token
    if not all(part.isalpha() for part in parts):
        return token
    if max(len(part) for part in parts) > config.NORMALIZE_MAX_LETTER_RUN_FOR_JOIN:
        return token
    return "".join(parts)


def join_split_letters(text: str) -> str:
    if not text:
        return ""
    return "".join(
        piece if piece.isspace() else _join_token(piece)
        for piece in _TOKEN_SPLIT_RE.split(text)
    )


def collapse_repeats(text: str) -> str:
    if not text:
        return ""
    return _repeat_re().sub(r"\1", text)


def collapse_doubles(text: str) -> str:
    if not text:
        return ""
    return _DOUBLE_RE.sub(r"\1", text)


def _leet_token(token: str) -> str:
    if not any(char.isalpha() for char in token):
        return token
    if not any(char in config.LEET_MAP for char in token):
        return token
    if not any(char.isdigit() or char in config.LEET_MAP for char in token):
        return token
    return "".join(config.LEET_MAP.get(char, char) for char in token)


def apply_leet(text: str) -> str:
    if not text:
        return ""
    return "".join(
        piece if piece.isspace() else _leet_token(piece)
        for piece in _TOKEN_SPLIT_RE.split(text)
    )


def _teencode_token(token: str) -> str:
    prefix = ""
    suffix = ""
    core = token

    while core and not core[0].isalnum():
        prefix += core[0]
        core = core[1:]
    while core and not core[-1].isalnum():
        suffix = core[-1] + suffix
        core = core[:-1]

    replacement = config.TEENCODE_MAP.get(core)
    if replacement is None:
        return token
    return prefix + replacement + suffix


def apply_teencode(text: str) -> str:
    if not text:
        return ""
    return "".join(
        piece if piece.isspace() else _teencode_token(piece)
        for piece in _TOKEN_SPLIT_RE.split(text)
    )


def normalize(text: str) -> str:
    base = unicodedata.normalize("NFC", text or "").casefold()
    base = _INVISIBLE_RE.sub("", base)
    base = _WHITESPACE_RE.sub(" ", base).strip()
    return _full_variant(base)


def _full_variant(base: str) -> str:
    text = _INVISIBLE_RE.sub("", base)
    text = join_split_letters(text)
    text = collapse_repeats(text)
    text = apply_leet(text)
    text = apply_teencode(text)
    return _WHITESPACE_RE.sub(" ", text).strip()


@lru_cache(maxsize=config.NORMALIZE_CACHE_SIZE)
def build_variants(base: str) -> tuple:
    """Trả về tuple (tên biến thể, chuỗi) đã khử trùng lặp.

    `base` là kết quả của guardrails._normalize(), luôn được giữ nguyên làm
    biến thể đầu tiên để lớp từ khoá không bao giờ mất một lượt bắt nào so với
    trước khi có Layer 0.
    """
    if not base:
        return ()

    full = _full_variant(base)
    nodiacritic = strip_diacritics(full)

    candidates = (
        ("v0_base", base),
        ("v1_full", full),
        ("v2_nodouble", collapse_doubles(full)),
        ("v3_nospace", strip_spaces(full)),
        ("v4_nodiacritic", nodiacritic),
        ("v5_nodiacritic_nospace", strip_spaces(nodiacritic)),
    )

    variants = []
    seen = set()
    for name, value in candidates:
        if not value or value in seen:
            continue
        seen.add(value)
        variants.append((name, value))
    return tuple(variants)
