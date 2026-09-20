"""Ket noi Postgres dung chung cho phan dang nhap va luu lich su.

Neu khong co DATABASE_URL thi moi thu o day deu tra ve "chua cau hinh" chu
khong raise: app van chay binh thuong o che do khach.
"""

import os
from contextlib import contextmanager

import config

__all__ = [
    "is_configured",
    "connection",
    "init_schema",
    "status",
    "DatabaseUnavailable",
]


class DatabaseUnavailable(RuntimeError):
    pass


_pool = None
_schema_ready = False


def database_url() -> str:
    return (os.getenv(config.DATABASE_URL_ENV) or "").strip()


def is_configured() -> bool:
    return bool(database_url())


def _get_pool():
    global _pool
    if _pool is not None:
        return _pool

    if not is_configured():
        raise DatabaseUnavailable(
            "Chua co {env} trong bien moi truong".format(env=config.DATABASE_URL_ENV)
        )

    from psycopg_pool import ConnectionPool

    _pool = ConnectionPool(
        database_url(),
        min_size=1,
        max_size=config.DB_POOL_MAX_SIZE,
        timeout=config.DB_CONNECT_TIMEOUT_SECONDS,
        open=True,
    )
    return _pool


@contextmanager
def connection():
    try:
        pool = _get_pool()
    except DatabaseUnavailable:
        raise
    except Exception as error:
        raise DatabaseUnavailable(str(error))

    with pool.connection() as conn:
        yield conn


def init_schema(force: bool = False) -> bool:
    """Tao bang neu chua co. Tra ve True neu luoc do da san sang."""
    global _schema_ready
    if _schema_ready and not force:
        return True

    with open(config.DB_SCHEMA_PATH, "r", encoding="utf-8") as handle:
        schema_sql = handle.read()

    with connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(schema_sql)
        conn.commit()

    _schema_ready = True
    return True


def status() -> dict:
    payload = {
        "configured": is_configured(),
        "connected": False,
        "schema_ready": False,
        "users": 0,
        "messages": 0,
        "error": None,
    }
    if not payload["configured"]:
        return payload

    try:
        with connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                payload["connected"] = True
                cursor.execute(
                    "SELECT to_regclass('public.users'), to_regclass('public.messages')"
                )
                tables = cursor.fetchone()
                payload["schema_ready"] = all(tables)
                if payload["schema_ready"]:
                    cursor.execute("SELECT count(*) FROM users")
                    payload["users"] = cursor.fetchone()[0]
                    cursor.execute("SELECT count(*) FROM messages")
                    payload["messages"] = cursor.fetchone()[0]
    except Exception as error:
        payload["error"] = "{name}: {msg}".format(name=type(error).__name__, msg=error)
    return payload
