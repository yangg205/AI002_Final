"""Dang nhap bang ten dang nhap va mat khau.

Khong phan quyen: moi tai khoan chi co quyen tren du lieu cua chinh no, va
viec do duoc dam bao o tang storage (moi truy van deu loc theo user_id).

Mat khau bam bang bcrypt, khong bao gio luu ban ro va khong bao gio ghi ra log.
"""

import base64
import hashlib
import hmac
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone

import config
import db

__all__ = [
    "AuthError",
    "AuthTokenConfigError",
    "validate_username",
    "validate_password",
    "create_user",
    "authenticate",
    "ensure_token_signing_configured",
    "issue_access_token",
    "decode_access_token",
    "record_consent",
    "delete_user",
    "get_user",
]


class AuthError(Exception):
    pass


class AuthTokenConfigError(RuntimeError):
    pass


def _token_secret() -> bytes:
    secret = os.getenv(config.AUTH_TOKEN_SECRET_ENV, "").strip()
    if len(secret) < 32:
        raise AuthTokenConfigError(
            "Cần cấu hình {0} với ít nhất 32 ký tự.".format(
                config.AUTH_TOKEN_SECRET_ENV
            )
        )
    return secret.encode("utf-8")


def ensure_token_signing_configured() -> None:
    _token_secret()


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))


def issue_access_token(user: dict) -> dict:
    """Tạo access token HS256 có thời hạn cho các API client."""
    secret = _token_secret()
    now = int(time.time())
    expires_in = config.AUTH_TOKEN_TTL_SECONDS
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": config.AUTH_TOKEN_ISSUER,
        "sub": str(user["id"]),
        "username": user["username"],
        "iat": now,
        "exp": now + expires_in,
    }
    encoded_header = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    encoded_payload = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    )
    message = "{0}.{1}".format(encoded_header, encoded_payload).encode("ascii")
    signature = hmac.new(secret, message, hashlib.sha256).digest()
    return {
        "access_token": "{0}.{1}".format(message.decode("ascii"), _b64url_encode(signature)),
        "token_type": "bearer",
        "expires_in": expires_in,
    }


def decode_access_token(token: str) -> dict:
    """Xác thực chữ ký và thời hạn của access token."""
    secret = _token_secret()
    try:
        if not token or len(token) > 8192:
            raise ValueError("invalid token length")
        encoded_header, encoded_payload, encoded_signature = token.split(".")
        message = "{0}.{1}".format(encoded_header, encoded_payload).encode("ascii")
        expected = hmac.new(secret, message, hashlib.sha256).digest()
        supplied = _b64url_decode(encoded_signature)
        if not hmac.compare_digest(expected, supplied):
            raise ValueError("invalid signature")

        header = json.loads(_b64url_decode(encoded_header))
        payload = json.loads(_b64url_decode(encoded_payload))
        if header.get("alg") != "HS256" or header.get("typ") != "JWT":
            raise ValueError("invalid token header")
        if payload.get("iss") != config.AUTH_TOKEN_ISSUER:
            raise ValueError("invalid token issuer")
        if not str(payload.get("sub", "")).isdigit():
            raise ValueError("invalid token subject")
        if int(payload.get("exp", 0)) <= int(time.time()):
            raise ValueError("expired token")
        return payload
    except AuthTokenConfigError:
        raise
    except Exception as error:
        raise AuthError("Access token không hợp lệ hoặc đã hết hạn.") from error


def _hash_password(password: str) -> str:
    import bcrypt

    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    import bcrypt

    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def validate_username(username: str) -> str:
    username = (username or "").strip()
    if not username:
        return "Bạn chưa nhập tên đăng nhập."
    if not re.match(config.AUTH_USERNAME_PATTERN, username):
        return (
            "Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang, "
            "dài 3 đến 32 ký tự."
        )
    return ""


def validate_password(password: str, confirm: str = None) -> str:
    password = password or ""
    if len(password) < config.AUTH_MIN_PASSWORD_LENGTH:
        return "Mật khẩu cần ít nhất {0} ký tự.".format(config.AUTH_MIN_PASSWORD_LENGTH)
    if len(password.encode("utf-8")) > config.AUTH_MAX_PASSWORD_BYTES:
        return "Mật khẩu không được vượt quá {0} byte.".format(
            config.AUTH_MAX_PASSWORD_BYTES
        )
    if confirm is not None and password != confirm:
        return "Hai lần nhập mật khẩu chưa khớp nhau."
    return ""


def create_user(username: str, password: str) -> dict:
    username = (username or "").strip()
    password_hash = _hash_password(password)

    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM users WHERE username = %s", (username,))
            if cursor.fetchone():
                raise AuthError("Tên đăng nhập này đã có người dùng.")

            cursor.execute(
                "INSERT INTO users (username, password_hash) VALUES (%s, %s) "
                "RETURNING id, username, consent_at",
                (username, password_hash),
            )
            row = cursor.fetchone()
        conn.commit()

    return {"id": row[0], "username": row[1], "consent_at": row[2]}


def authenticate(username: str, password: str) -> dict:
    username = (username or "").strip()
    now = datetime.now(timezone.utc)

    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, username, password_hash, consent_at, failed_attempts, locked_until "
                "FROM users WHERE username = %s",
                (username,),
            )
            row = cursor.fetchone()

            if row is None:
                raise AuthError("Sai tên đăng nhập hoặc mật khẩu.")

            user_id, username, password_hash, consent_at, failed_attempts, locked_until = row

            if locked_until and locked_until > now:
                remaining = int((locked_until - now).total_seconds() // 60) + 1
                raise AuthError(
                    "Tài khoản đang tạm khoá do nhập sai nhiều lần. "
                    "Thử lại sau {0} phút.".format(remaining)
                )

            if not _verify_password(password, password_hash):
                attempts = (failed_attempts or 0) + 1
                locked = None
                if attempts >= config.AUTH_MAX_FAILED_ATTEMPTS:
                    locked = now + timedelta(minutes=config.AUTH_LOCKOUT_MINUTES)
                    attempts = 0
                cursor.execute(
                    "UPDATE users SET failed_attempts = %s, locked_until = %s WHERE id = %s",
                    (attempts, locked, user_id),
                )
                conn.commit()
                if locked:
                    raise AuthError(
                        "Sai quá {0} lần, tài khoản bị khoá {1} phút.".format(
                            config.AUTH_MAX_FAILED_ATTEMPTS, config.AUTH_LOCKOUT_MINUTES
                        )
                    )
                raise AuthError("Sai tên đăng nhập hoặc mật khẩu.")

            cursor.execute(
                "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = %s",
                (user_id,),
            )
        conn.commit()

    return {"id": user_id, "username": username, "consent_at": consent_at}


def get_user(user_id: int) -> dict:
    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, username, consent_at FROM users WHERE id = %s", (user_id,)
            )
            row = cursor.fetchone()
    if row is None:
        raise AuthError("Không tìm thấy tài khoản.")
    return {"id": row[0], "username": row[1], "consent_at": row[2]}


def record_consent(user_id: int) -> None:
    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE users SET consent_at = now() WHERE id = %s AND consent_at IS NULL",
                (user_id,),
            )
        conn.commit()


def revoke_consent(user_id: int) -> None:
    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE users SET consent_at = NULL WHERE id = %s", (user_id,))
        conn.commit()


def delete_user(user_id: int) -> None:
    """Xoa tai khoan. Hoi thoai va tin nhan bi xoa theo (ON DELETE CASCADE)."""
    with db.connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
