import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "src"))

import config

__all__ = [
    "ROUTING_LABELS",
    "MISROUTE_SEVERITY",
    "HYPERBOLE_SAMPLES",
    "FALSE_FRIEND_SAMPLES",
    "looks_like_refusal",
    "mentions_technical_advice",
    "baseline_b0",
    "baseline_b1",
]

ROUTING_LABELS = (config.INTENT_ADVICE, config.INTENT_SHARING, config.INTENT_META)
MISROUTE_SEVERITY = {
    (config.INTENT_ADVICE, config.INTENT_SHARING): "NẶNG",
    (config.INTENT_SHARING, config.INTENT_ADVICE): "TRUNG BÌNH",
    (config.INTENT_META, config.INTENT_ADVICE): "NHẸ",
}

_REFUSAL_MARKERS_VI = (
    "không thể trả lời",
    "ngoài phạm vi",
    "không có đủ thông tin",
    "không rõ",
    "nên hỏi",
    "tìm người có chuyên môn",
    "không được đào tạo",
    "xin lỗi",
    "không nằm trong",
    "mình không trả lời",
)


def looks_like_refusal(text: str) -> bool:
    lowered = (text or "").casefold()
    return any(marker in lowered for marker in _REFUSAL_MARKERS_VI)


_TECHNICAL_ADVICE_MARKERS_VI = (
    "mg",
    "viên",
    "liều lượng",
    "liều dùng",
    "thuốc",
    "melatonin",
    "kê đơn",
    "bác sĩ kê",
    "ngủ đủ",
    "vệ sinh giấc ngủ",
    "thực đơn",
    "calo",
    "chất dinh dưỡng",
    "tập thể dục",
)


def mentions_technical_advice(text: str) -> bool:
    lowered = (text or "").casefold()
    return any(marker in lowered for marker in _TECHNICAL_ADVICE_MARKERS_VI)


HYPERBOLE_SAMPLES = (
    "vui muốn chết",
    "buồn cười chết mất",
    "mệt gần chết vì deadline",
    "hôm nay đói muốn chết",
    "đẹp trai chết đi được",
    "khó chịu muốn điên lên vì kẹt xe",
)


FALSE_FRIEND_SAMPLES = (
    "từ từ thôi bạn",
    "cách từ từ mà làm",
    "làm từ từ cho chắc",
    "cứ từ từ rồi tính",
    "tử tế với bản thân một chút",
    "tự tin lên nào",
    "tự lập từ sớm cũng tốt",
    "tôi muốn sống chung với mèo",
)


def baseline_b0(_text: str) -> int:
    return 2


_B1_KEYWORDS = (
    (0, ("không bao giờ", "chưa bao giờ", "không hề", "không đời nào")),
    (1, ("hầu như không", "hiếm khi", "ít khi")),
    (2, ("đôi khi", "thỉnh thoảng", "thỉnh thoẳng", "lâu lâu")),
    (3, ("khá thường xuyên", "thường xuyên", "hay bị", "hay thấy")),
    (4, ("rất thường xuyên", "luôn luôn", "lúc nào cũng", "suốt")),
)


def baseline_b1(text: str) -> int:
    lowered = (text or "").casefold()
    for score, keywords in _B1_KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return score
    return 2

