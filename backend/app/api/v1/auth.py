"""Authentication and user-management endpoints."""

from __future__ import annotations

import uuid

import jwt
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.core.errors import AuthError
from app.core.security import REFRESH, create_access_token, create_refresh_token, decode_token
from app.models.user import ApplicationUser
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])


def _tokens(user: ApplicationUser) -> TokenResponse:
    access = create_access_token(str(user.id), {"role": user.role, "code": user.employee_code})
    refresh = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = auth_service.authenticate(db, payload.employee_code, payload.password)
    return _tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        data = decode_token(payload.refresh_token)
    except jwt.PyJWTError as exc:
        raise AuthError("Invalid refresh token", code="INVALID_TOKEN") from exc
    if data.get("type") != REFRESH:
        raise AuthError("Not a refresh token", code="INVALID_TOKEN_TYPE")
    user = auth_service.get_user(db, uuid.UUID(data["sub"]))
    if not user.is_active:
        raise AuthError("User disabled", code="USER_DISABLED")
    return _tokens(user)


@router.get("/me", response_model=UserOut)
def me(user: ApplicationUser = Depends(get_current_user)) -> ApplicationUser:
    return user


# ---- User administration (admin only) ----


@users_router.get("", response_model=list[UserOut])
def list_users(_: ApplicationUser = Depends(require_admin), db: Session = Depends(get_db)):
    return auth_service.list_users(db)


@users_router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return auth_service.create_user(db, payload)


@users_router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return auth_service.update_user(db, user_id, payload)
