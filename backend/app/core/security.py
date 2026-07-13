"""Password hashing and JWT token helpers."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import settings

# ---- Password hashing (bcrypt directly; bcrypt has a 72-byte input limit) ----


def hash_password(password: str) -> str:
    pwd = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8")[:72], password_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


# ---- JWT ----

ACCESS = "access"
REFRESH = "refresh"


def _create_token(subject: str, token_type: str, expires_minutes: int, extra: dict | None = None) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str, extra: dict | None = None) -> str:
    return _create_token(subject, ACCESS, settings.access_token_expire_minutes, extra)


def create_refresh_token(subject: str) -> str:
    return _create_token(subject, REFRESH, settings.refresh_token_expire_minutes)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
