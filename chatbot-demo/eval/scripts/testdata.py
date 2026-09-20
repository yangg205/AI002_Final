import csv
import json
from pathlib import Path


def read_jsonl(path: Path):
    if not path.exists():
        return None
    rows = []
    with open(path, "r", encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as error:
                print(
                    "  CANH BAO: bo qua dong {0} trong {1} (loi JSON: {2})".format(
                        line_no, path.name, error
                    )
                )
    return rows


def read_csv_dicts(path: Path):
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8", newline="") as handle:
        lines = [line for line in handle if line.strip() and not line.lstrip().startswith("#")]
    return list(csv.DictReader(lines))


def missing_file_message(path: Path, phase_hint: str = "Giai doan D") -> str:
    return (
        "BO QUA: khong tim thay {0}. Chay {1} de sinh file nay, hoac tu tao "
        "theo dung schema mo ta trong docstring cua script nay.".format(path, phase_hint)
    )

