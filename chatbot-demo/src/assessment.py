from functools import lru_cache

import pandas as pd

import config

__all__ = [
    "load_questions",
    "score",
    "level_for_score",
    "reverse_item_ids",
    "init_state",
    "reset_state",
    "current_index",
    "current_question",
    "record_answer",
    "answers",
    "is_complete",
    "progress",
]


@lru_cache(maxsize=1)
def load_questions() -> "list[dict]":
    frame = pd.read_csv(config.PSS10_QUESTIONS_PATH, dtype=str, keep_default_na=False)

    required = {"item_id", "text_vi", "reverse", "options"}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(
            "pss10_questions.csv thiếu cột: " + ", ".join(sorted(missing))
        )

    if len(frame) != config.PSS10_NUM_ITEMS:
        raise ValueError(
            "pss10_questions.csv phải có đúng {expected} dòng, đang có {actual}.".format(
                expected=config.PSS10_NUM_ITEMS, actual=len(frame)
            )
        )

    expected_options = config.LIKERT_MAX - config.LIKERT_MIN + 1
    questions = []
    for position, row in enumerate(frame.to_dict("records"), start=1):
        item_id = int(str(row["item_id"]).strip())
        if item_id != position:
            raise ValueError(
                "item_id phải liên tục từ 1 đến {n} theo đúng thứ tự; "
                "dòng thứ {pos} có item_id={item_id}.".format(
                    n=config.PSS10_NUM_ITEMS, pos=position, item_id=item_id
                )
            )

        options = [part.strip() for part in str(row["options"]).split("|")]
        options = [part for part in options if part]
        if len(options) != expected_options:
            raise ValueError(
                "Item {item_id} phải có đúng {expected} phương án, đang có {actual}.".format(
                    item_id=item_id, expected=expected_options, actual=len(options)
                )
            )

        reverse_flag = str(row["reverse"]).strip().lower() in {"true", "1", "yes", "y"}
        declared_reverse = item_id in config.REVERSE_ITEMS
        if reverse_flag != declared_reverse:
            raise ValueError(
                "Item {item_id}: cột reverse trong CSV ({csv}) không khớp "
                "config.REVERSE_ITEMS ({cfg}).".format(
                    item_id=item_id, csv=reverse_flag, cfg=declared_reverse
                )
            )

        questions.append(
            {
                "item_id": item_id,
                "text_vi": str(row["text_vi"]).strip(),
                "reverse": declared_reverse,
                "options": options,
            }
        )
    return questions


def reverse_item_ids() -> "tuple":
    return config.REVERSE_ITEMS


def level_for_score(total: int) -> str:
    for low, high, name in config.PSS10_LEVELS:
        if low <= total <= high:
            return name
    raise ValueError(
        "Tổng điểm {total} nằm ngoài khoảng {lo}-{hi} của PSS-10.".format(
            total=total, lo=config.PSS10_SCORE_MIN, hi=config.PSS10_SCORE_MAX
        )
    )


def score(answers: "list[int]") -> "tuple[int, str]":
    if answers is None:
        raise ValueError("answers không được là None.")

    values = list(answers)
    if len(values) != config.PSS10_NUM_ITEMS:
        raise ValueError(
            "Cần đúng {expected} câu trả lời, nhận được {actual}.".format(
                expected=config.PSS10_NUM_ITEMS, actual=len(values)
            )
        )

    total = 0
    for index, raw in enumerate(values):
        item_id = index + 1
        if isinstance(raw, bool) or raw is None:
            raise ValueError(
                "Câu trả lời của item {item_id} không hợp lệ: {raw!r}".format(
                    item_id=item_id, raw=raw
                )
            )
        try:
            value = int(raw)
        except (TypeError, ValueError):
            raise ValueError(
                "Câu trả lời của item {item_id} không phải số nguyên: {raw!r}".format(
                    item_id=item_id, raw=raw
                )
            )
        if not config.LIKERT_MIN <= value <= config.LIKERT_MAX:
            raise ValueError(
                "Item {item_id}: điểm {value} ngoài khoảng {lo}-{hi}.".format(
                    item_id=item_id,
                    value=value,
                    lo=config.LIKERT_MIN,
                    hi=config.LIKERT_MAX,
                )
            )
        if item_id in config.REVERSE_ITEMS:
            value = config.LIKERT_MAX - value
        total += value

    return total, level_for_score(total)


KEY_INDEX = "pss10_index"
KEY_ANSWERS = "pss10_answers"


def init_state(state) -> None:
    if KEY_INDEX not in state:
        state[KEY_INDEX] = 0
    if KEY_ANSWERS not in state:
        state[KEY_ANSWERS] = []


def reset_state(state) -> None:
    state[KEY_INDEX] = 0
    state[KEY_ANSWERS] = []


def current_index(state) -> int:
    init_state(state)
    return int(state[KEY_INDEX])


def answers(state) -> "list[int]":
    init_state(state)
    return list(state[KEY_ANSWERS])


def is_complete(state) -> bool:
    return len(answers(state)) >= config.PSS10_NUM_ITEMS


def current_question(state) -> "dict":
    if is_complete(state):
        return None
    return load_questions()[current_index(state)]


def record_answer(state, raw_value: int) -> None:
    init_state(state)
    if is_complete(state):
        raise ValueError("Đã trả lời đủ 10 item, không thể ghi thêm.")

    value = int(raw_value)
    if not config.LIKERT_MIN <= value <= config.LIKERT_MAX:
        raise ValueError(
            "Điểm {value} ngoài khoảng {lo}-{hi}.".format(
                value=value, lo=config.LIKERT_MIN, hi=config.LIKERT_MAX
            )
        )

    state[KEY_ANSWERS] = list(state[KEY_ANSWERS]) + [value]
    state[KEY_INDEX] = len(state[KEY_ANSWERS])


def progress(state) -> "tuple[int, int]":
    return len(answers(state)), config.PSS10_NUM_ITEMS

