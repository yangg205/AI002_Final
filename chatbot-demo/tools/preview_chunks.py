import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import config
import rag_engine


def main() -> None:
    show_full = "--full" in sys.argv

    pages = rag_engine.extract_pages()
    chunks = rag_engine.build_chunks(pages)
    stats = rag_engine.chunk_stats(chunks)

    print("=" * 78)
    print("TONG:", stats["total_chunks"], "chunk")
    print(
        "Ky tu/chunk: min {min} | max {max} | trung binh {avg:.0f}".format(
            min=stats["min_chars"], max=stats["max_chars"], avg=stats["avg_chars"]
        )
    )
    print(
        "Muc tieu cau hinh: {lo}-{hi} ky tu, toi da {mp} trang, chong lan {ov} trang".format(
            lo=config.CHUNK_TARGET_MIN_CHARS,
            hi=config.CHUNK_TARGET_MAX_CHARS,
            mp=config.CHUNK_MAX_PAGES,
            ov=config.CHUNK_OVERLAP_PAGES,
        )
    )
    print("=" * 78)

    print("\n{:<18} {:>7} {:>12} {:>14}".format("skill", "chunks", "tb ky tu", "trang phu"))
    for skill, value in stats["per_skill"].items():
        first, last = config.DWM_SKILL_PAGE_RANGES[skill]
        print(
            "{:<18} {:>7} {:>12.0f} {:>8}/{:<5}".format(
                skill,
                value["chunks"],
                value["avg_chars"],
                value["pages_covered"],
                last - first + 1 + 1,
            )
        )

    print("\n### DANH SACH CHUNK")
    for chunk in chunks:
        pages_label = "-".join(
            [str(chunk["pages"][0]), str(chunk["pages"][-1])]
            if len(chunk["pages"]) > 1
            else [str(chunk["pages"][0])]
        )
        print(
            "{id:<34} {kind:<8} trang {pages:<9} {chars:>5} ky tu".format(
                id=chunk["id"],
                kind=chunk["kind"],
                pages=pages_label,
                chars=len(chunk["text"]),
            )
        )

    print("\n### KIEM TRA RANG BUOC")
    ok = True

    for chunk in chunks:
        skills = {rag_engine.skill_of_page(p) for p in chunk["pages"]}
        if skills != {chunk["skill"]}:
            ok = False
            print("   LOI: chunk", chunk["id"], "vat qua nhieu ky nang:", skills)
    print("   [1] Khong chunk nao vat qua 2 ky nang:", "OK" if ok else "SAI")

    excluded = set(range(1, 10)) | {121, 127}
    leaked = sorted({p for c in chunks for p in c["pages"]} & excluded)
    print(
        "   [2] Khong index front matter / 121 / 127:",
        "OK" if not leaked else "SAI - lot trang {0}".format(leaked),
    )

    overlap_ok = True
    for skill in config.DWM_SKILL_PAGE_RANGES:
        content = [c for c in chunks if c["skill"] == skill and c["kind"] == "content"]
        for previous, current in zip(content, content[1:]):
            shared = set(previous["pages"]) & set(current["pages"])
            if len(shared) != config.CHUNK_OVERLAP_PAGES:
                overlap_ok = False
                print(
                    "   Chu y:", skill, previous["pages"], "->", current["pages"],
                    "chong lan", len(shared), "trang",
                )
    print(
        "   [3] Chong lan dung {0} trang giua cac chunk lien tiep:".format(
            config.CHUNK_OVERLAP_PAGES
        ),
        "OK" if overlap_ok else "CO NGOAI LE (xem tren)",
    )

    empty = [c["id"] for c in chunks if len(c["text"].strip()) < 200]
    print("   [4] Khong co chunk qua ngan (<200 ky tu):", "OK" if not empty else empty)

    if show_full:
        for chunk in chunks:
            print("\n" + "=" * 78)
            print(chunk["id"], "| skill:", chunk["skill"], "| trang:", chunk["pages"])
            print("-" * 78)
            print(chunk["text"])


if __name__ == "__main__":
    main()

