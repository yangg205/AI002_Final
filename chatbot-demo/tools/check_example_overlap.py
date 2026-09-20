import csv
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "eval" / "scripts"))

import config
import guardrails
import text_normalize
import heuristics

EXAMPLES_PATH = PROJECT_ROOT / "data" / "knn_examples.jsonl"
HOLDOUT_PATH = PROJECT_ROOT / "eval" / "input" / "knn_holdout.jsonl"
EVAL_JSONL = (
    PROJECT_ROOT / "eval" / "input" / "testset.jsonl",
    PROJECT_ROOT / "eval" / "input" / "routing_test.jsonl",
    PROJECT_ROOT / "eval" / "input" / "bypass_test.jsonl",
    HOLDOUT_PATH,
)
GOLD_PATH = PROJECT_ROOT / "eval" / "input" / "mapping_gold.csv"

JACCARD_LIMIT = 0.80
NGRAM_SIZE = 5
_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)


def canonical(text: str) -> str:
    normalized = guardrails._normalize(text)
    stripped = text_normalize.strip_diacritics(normalized)
    return re.sub(r"\s+", " ", _PUNCT_RE.sub(" ", stripped)).strip()


def ngrams(text: str) -> set:
    packed = text.replace(" ", "")
    if len(packed) <= NGRAM_SIZE:
        return {packed}
    return {packed[i : i + NGRAM_SIZE] for i in range(len(packed) - NGRAM_SIZE + 1)}


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def read_jsonl(path: Path) -> list:
    rows = []
    if not path.exists():
        return rows
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            rows.append(json.loads(line))
    return rows


def load_eval_texts() -> list:
    texts = []
    for path in EVAL_JSONL:
        for row in read_jsonl(path):
            value = row.get("input")
            if value:
                texts.append((path.name, value))
    if GOLD_PATH.exists():
        with open(GOLD_PATH, "r", encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                value = (row.get("user_raw_text") or "").strip()
                if value:
                    texts.append((GOLD_PATH.name, value))
    for value in heuristics.HYPERBOLE_SAMPLES:
        texts.append(("heuristics.HYPERBOLE_SAMPLES", value))
    for value in heuristics.FALSE_FRIEND_SAMPLES:
        texts.append(("heuristics.FALSE_FRIEND_SAMPLES", value))
    return texts


def validate(examples: list) -> list:
    problems = []
    seen_ids = set()
    kinds = {"risk", "intent"}
    labels = {"risk": {"risk", "safe"}, "intent": {"advice", "sharing", "meta"}}

    for row in examples:
        row_id = row.get("id", "(thieu id)")
        if row_id in seen_ids:
            problems.append("id trung: {0}".format(row_id))
        seen_ids.add(row_id)
        if row.get("kind") not in kinds:
            problems.append("{0}: kind khong hop le {1!r}".format(row_id, row.get("kind")))
            continue
        if row.get("label") not in labels[row["kind"]]:
            problems.append("{0}: label khong hop le {1!r}".format(row_id, row.get("label")))
        if row.get("split") not in {"train", "dev"}:
            problems.append("{0}: split khong hop le {1!r}".format(row_id, row.get("split")))
        if not (row.get("text") or "").strip():
            problems.append("{0}: text rong".format(row_id))
    return problems


def summarize(examples: list) -> None:
    counts = {}
    for row in examples:
        key = (row.get("kind"), row.get("label"), row.get("split"))
        counts[key] = counts.get(key, 0) + 1
    print("Thong ke bo cau mau:")
    for key in sorted(counts, key=lambda k: (str(k[0]), str(k[1]), str(k[2]))):
        kind, label, split = key
        print("  {0:<7} {1:<8} {2:<6} {3}".format(kind, label, split, counts[key]))
    print("  tong: {0}".format(len(examples)))


def main() -> int:
    examples = read_jsonl(EXAMPLES_PATH)
    if not examples:
        print("KHONG doc duoc {0}".format(EXAMPLES_PATH))
        return 2

    summarize(examples)
    print()

    problems = validate(examples)
    if problems:
        print("LOI SCHEMA ({0}):".format(len(problems)))
        for item in problems:
            print("  -", item)
        return 1
    print("Schema: OK")

    eval_texts = load_eval_texts()
    eval_index = [(source, value, canonical(value), ngrams(canonical(value))) for source, value in eval_texts]
    eval_exact = {}
    for source, value, key, _ in eval_index:
        eval_exact.setdefault(key, (source, value))

    exact_hits = []
    near_hits = []
    worst = (0.0, None, None, None)

    empty_canonical = []
    for row in examples:
        key = canonical(row["text"])
        if not key:
            empty_canonical.append((row["id"], row["text"]))
            continue
        grams = ngrams(key)
        if key in eval_exact:
            source, value = eval_exact[key]
            exact_hits.append((row["id"], row["text"], source, value))
            continue
        for source, value, other_key, other_grams in eval_index:
            score = jaccard(grams, other_grams)
            if score > worst[0]:
                worst = (score, row["id"], source, value)
            if score >= JACCARD_LIMIT:
                near_hits.append((row["id"], row["text"], source, value, score))

    print()
    print("So cau mau: {0} | so dong eval doi chieu: {1}".format(len(examples), len(eval_index)))
    print("Trung khop chinh xac: {0}".format(len(exact_hits)))
    for row_id, text, source, value in exact_hits:
        print("  - {0}: {1!r}\n      <-> {2}: {3!r}".format(row_id, text[:70], source, value[:70]))

    print("Gan trung (Jaccard 5-gram >= {0:.2f}): {1}".format(JACCARD_LIMIT, len(near_hits)))
    for row_id, text, source, value, score in sorted(near_hits, key=lambda x: -x[4]):
        print("  - {0} ({1:.2f}): {2!r}\n      <-> {3}: {4!r}".format(row_id, score, text[:70], source, value[:70]))

    print("Jaccard cao nhat toan bo: {0:.3f} ({1} <-> {2})".format(worst[0], worst[1], worst[2]))

    if empty_canonical:
        print()
        print("CANH BAO: {0} cau mau khong con ky tu chu sau chuan hoa (emoji / dau cau thuan tuy),".format(len(empty_canonical)))
        print("khong the doi chieu ro ri va embedding cua chung gan nhu vo nghia:")
        for row_id, text in empty_canonical:
            print("  - {0}: {1!r}".format(row_id, text[:40]))

    if exact_hits or near_hits:
        print()
        print("KET QUA: THAT BAI - sua du lieu mau truoc khi index.")
        return 1

    print()
    print("KET QUA: DAT - khong co ro ri chuoi giua bo cau mau va bo eval.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
