import argparse


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Bo qua cache doc, luon goi API moi (van ghi de cache sau khi goi).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chi dem so luot se goi API, KHONG goi that.",
    )

