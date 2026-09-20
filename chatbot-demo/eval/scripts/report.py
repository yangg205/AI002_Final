import csv
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "src"))

import config

RESULTS_PATH = Path(__file__).resolve().parent.parent / "output" / "results.md"


def config_snapshot() -> dict:
    return {
        "groq_model": config.GROQ_MODEL,
        "groq_risk_model": config.GROQ_RISK_MODEL,
        "groq_intent_model": config.GROQ_INTENT_MODEL,
        "gemini_embed_model": config.GEMINI_EMBED_MODEL,
        "rag_similarity_threshold": config.RAG_SIMILARITY_THRESHOLD,
        "rag_top_k": config.RAG_TOP_K,
        "normalize_enabled": config.NORMALIZE_ENABLED,
        "risk_prompt_version": config.RISK_PROMPT_VERSION,
        "intent_prompt_version": config.INTENT_PROMPT_VERSION,
    }


def append_report(title: str, body_lines: "list[str]", extra_config: dict = None) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    snapshot = config_snapshot()
    if extra_config:
        snapshot.update(extra_config)

    lines = ["", "## {0} — {1}".format(title, timestamp), "", "Cấu hình lúc chạy:"]
    for key, value in snapshot.items():
        lines.append("- `{0}` = `{1}`".format(key, value))
    lines.append(
        "- commit hash: _không tự lấy (chính sách không chạy lệnh git tự "
        "động) - tự đối chiếu bằng `git rev-parse --short HEAD` nếu cần_"
    )
    lines.append("")
    lines.extend(body_lines)
    lines.append("")

    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")
    return RESULTS_PATH


def write_csv(path: Path, fieldnames: "list[str]", rows: "list[dict]") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return path


def markdown_table(headers: "list[str]", rows: "list[list]") -> "list[str]":
    lines = ["| " + " | ".join(str(h) for h in headers) + " |"]
    lines.append("|" + "|".join(["---"] * len(headers)) + "|")
    for row in rows:
        lines.append("| " + " | ".join(str(cell) for cell in row) + " |")
    return lines

