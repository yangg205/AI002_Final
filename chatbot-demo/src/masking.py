import re

__all__ = ["mask_text"]

PHONE_REGEX_VI = re.compile(r"(?:\+84|84|0)(?:[\s.\-]?\d){9,10}")

CCCD_REGEX = re.compile(r"\b\d{12}\b")

EMAIL_REGEX = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

_PATTERNS = (
    ("email", EMAIL_REGEX),
    ("cccd", CCCD_REGEX),
    ("phone", PHONE_REGEX_VI),
)


def _partial_mask(matched: str) -> str:
    if len(matched) <= 4:
        return matched[0] + "***"
    return matched[0] + "***" + matched[-3:]


def mask_text(text: str) -> str:
    if not text:
        return text

    try:
        masked = text
        counts = {}
        for label, pattern in _PATTERNS:
            masked, n = pattern.subn(lambda m: _partial_mask(m.group(0)), masked)
            if n:
                counts[label] = n

        if counts:
            summary = ", ".join("{0}={1}".format(k, v) for k, v in counts.items())
            print(
                "[MASKING] Đã che PII ({0}) trước khi gửi LLM/embedding. "
                "Text gửi đi: {1}".format(summary, masked)
            )
        return masked
    except Exception:
        return text

