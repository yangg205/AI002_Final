import hashlib
import json
from pathlib import Path

CACHE_DIR = Path(__file__).resolve().parent / ".cache"


def cache_key(*parts) -> str:
    raw = json.dumps(list(parts), ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def cached_call(fn, cache_key_parts, use_cache=True, dry_run=False, counter=None):
    if counter is not None:
        counter["calls"] = counter.get("calls", 0) + 1

    if dry_run:
        return None

    key = cache_key(*cache_key_parts)
    path = CACHE_DIR / (key + ".json")

    if use_cache and path.exists():
        if counter is not None:
            counter["hits"] = counter.get("hits", 0) + 1
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)["result"]

    if counter is not None:
        counter["misses"] = counter.get("misses", 0) + 1

    result = fn()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".json.tmp")
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(
            {"cache_key_parts": list(cache_key_parts), "result": result},
            handle,
            ensure_ascii=False,
        )
    tmp_path.replace(path)

    return result


def cache_stats() -> dict:
    if not CACHE_DIR.exists():
        return {"files": 0, "bytes": 0}
    files = list(CACHE_DIR.glob("*.json"))
    return {"files": len(files), "bytes": sum(f.stat().st_size for f in files)}


def clear_cache() -> int:
    if not CACHE_DIR.exists():
        return 0
    files = list(CACHE_DIR.glob("*.json"))
    for f in files:
        f.unlink()
    return len(files)

