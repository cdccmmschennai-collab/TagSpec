"""Shared API dependencies: current user and role guards."""

from __future__ import annotations

from collections.abc import Callable

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AuthError, PermissionError_
from app.core.security import ACCESS, decode_token
from app.models.enums import UserRole
from app.models.user import ApplicationUser

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> ApplicationUser:
    if credentials is None or not credentials.credentials:
        raise AuthError("Authentication required", code="NOT_AUTHENTICATED")
    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Token expired", code="TOKEN_EXPIRED") from exc
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid token", code="INVALID_TOKEN") from exc

    if payload.get("type") != ACCESS:
        raise AuthError("Invalid token type", code="INVALID_TOKEN_TYPE")

    user_id = payload.get("sub")
    user = db.get(ApplicationUser, user_id) if user_id else None
    if user is None:
        raise AuthError("User not found", code="USER_NOT_FOUND")
    if not user.is_active:
        raise AuthError("User account is disabled", code="USER_DISABLED")
    return user


def require_roles(*roles: UserRole) -> Callable[[ApplicationUser], ApplicationUser]:
    allowed = {r.value for r in roles}

    def _guard(user: ApplicationUser = Depends(get_current_user)) -> ApplicationUser:
        if user.role not in allowed:
            raise PermissionError_(
                f"Requires one of roles: {', '.join(sorted(allowed))}",
                code="INSUFFICIENT_ROLE",
            )
        return user

    return _guard


# Convenience guards
require_admin = require_roles(UserRole.ADMIN)
require_supervisor = require_roles(UserRole.ADMIN, UserRole.SUPERVISOR)
require_editor = require_roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EDITOR)


def is_supervisor(user: ApplicationUser) -> bool:
    return user.role in {UserRole.ADMIN.value, UserRole.SUPERVISOR.value}
