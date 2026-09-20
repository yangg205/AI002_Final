import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import config
import rag_engine

IN_SCOPE = [
    "làm sao để tiếp đất khi mình bồn chồn",
    "tháo móc là gì",
    "chỉ tôi cách nào bớt căng thẳng đi",
    "cho mình một bài tập thở",
    "dọn chỗ cho cảm xúc khó chịu nghĩa là gì",
    "làm sao để tử tế với chính mình",
    "hành động dựa trên giá trị của bản thân là như thế nào",
    "mình bị suy nghĩ tiêu cực móc vào, phải làm gì",
    "cách gọi tên cảm xúc khi tức giận",
    "mình nên làm gì khi thấy đau khổ quá nhiều",
    "cách để chú ý vào hiện tại",
    "làm sao để không bị cảm xúc kéo đi",
]

OUT_OF_SCOPE = [
    "làm sao để ngủ ngon hơn",
    "cho mình thực đơn giảm cân",
    "nên uống thuốc gì khi mất ngủ",
    "cách quản lý thời gian hiệu quả",
    "học tiếng Anh thế nào cho nhanh",
    "giá bitcoin hôm nay bao nhiêu",
    "cách sửa lỗi python import error",
    "mình nên chọn ngành nào để thi đại học",
    "công thức nấu phở bò",
    "tập gym bao nhiêu buổi một tuần",
]


def top_scores(queries):
    rows = []
    for query in queries:
        hits = rag_engine.retrieve(query, k=config.RAG_TOP_K)
        top = hits[0] if hits else None
        rows.append(
            (
                query,
                top["score"] if top else 0.0,
                top["skill"] if top else "-",
                top["pages"] if top else [],
            )
        )
    return rows


def main() -> None:
    status = rag_engine.store_status()
    if status["needs_indexing"] or not status["chunks"]:
        print("Chua index. Chay: python3 tools/index_documents.py")
        return

    print("model:", config.GEMINI_EMBED_MODEL, "| dim:", config.GEMINI_EMBED_DIMENSIONS)
    print("so chunk:", status["chunks"], "| top_k:", config.RAG_TOP_K)

    print("\n### TRONG PHAM VI")
    in_rows = top_scores(IN_SCOPE)
    for query, score, skill, pages in in_rows:
        print("   {0:.4f}  {1:<18} {2!s:<16} {3}".format(score, skill, pages, query))

    print("\n### NGOAI PHAM VI")
    out_rows = top_scores(OUT_OF_SCOPE)
    for query, score, skill, pages in out_rows:
        print("   {0:.4f}  {1:<18} {2!s:<16} {3}".format(score, skill, pages, query))

    in_scores = [r[1] for r in in_rows]
    out_scores = [r[1] for r in out_rows]

    print("\n### TONG HOP")
    print(
        "trong pham vi: min {0:.4f} | trung binh {1:.4f} | max {2:.4f}".format(
            min(in_scores), sum(in_scores) / len(in_scores), max(in_scores)
        )
    )
    print(
        "ngoai pham vi: min {0:.4f} | trung binh {1:.4f} | max {2:.4f}".format(
            min(out_scores), sum(out_scores) / len(out_scores), max(out_scores)
        )
    )

    gap_low = max(out_scores)
    gap_high = min(in_scores)
    print("\nnguong hien tai trong config:", config.RAG_SIMILARITY_THRESHOLD)
    if gap_high > gap_low:
        suggestion = (gap_high + gap_low) / 2
        print(
            "khoang tach bach: {0:.4f} (ngoai cao nhat) -> {1:.4f} (trong thap nhat)".format(
                gap_low, gap_high
            )
        )
        print("=> de xuat nguong: {0:.2f}".format(suggestion))
    else:
        print(
            "CHONG LAN: ngoai cao nhat {0:.4f} >= trong thap nhat {1:.4f}\n"
            "   khong co nguong nao tach duoc hoan toan hai nhom.".format(
                gap_low, gap_high
            )
        )
        for candidate in [x / 100 for x in range(40, 90, 2)]:
            true_pos = sum(1 for s in in_scores if s >= candidate)
            false_pos = sum(1 for s in out_scores if s >= candidate)
            print(
                "   nguong {0:.2f}: nhan dung trong pham vi {1}/{2}, "
                "lot ngoai pham vi {3}/{4}".format(
                    candidate, true_pos, len(in_scores), false_pos, len(out_scores)
                )
            )


if __name__ == "__main__":
    main()

