"""User management and authentication."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AuthError, ConflictError, NotFoundError, ValidationAppError
from app.core.security import hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import ApplicationUser
from app.schemas.auth import UserCreate, UserUpdate

VALID_ROLES = {r.value for r in UserRole}


def _validate_role(role: str) -> str:
    role = role.strip().upper()
    if role not in VALID_ROLES:
        raise ValidationAppError(f"Invalid role '{role}'", code="INVALID_ROLE")
    return role


def authenticate(db: Session, employee_code: str, password: str) -> ApplicationUser:
    user = db.scalars(
        select(ApplicationUser).where(
            ApplicationUser.employee_code == employee_code.strip()
        )
    ).first()
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError("Invalid employee code or password", code="INVALID_CREDENTIALS")
    if not user.is_active:
        raise AuthError("User account is disabled", code="USER_DISABLED")
    return user


def get_user(db: Session, user_id: uuid.UUID) -> ApplicationUser:
    user = db.get(ApplicationUser, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


def list_users(db: Session) -> list[ApplicationUser]:
    return list(
        db.scalars(select(ApplicationUser).order_by(ApplicationUser.employee_code)).all()
    )


def create_user(db: Session, data: UserCreate) -> ApplicationUser:
    role = _validate_role(data.role)
    code = data.employee_code.strip()
    if db.scalars(
        select(ApplicationUser).where(ApplicationUser.employee_code == code)
    ).first() is not None:
        raise ConflictError("Employee code already exists", code="DUPLICATE_EMPLOYEE_CODE")
    user = ApplicationUser(
        employee_code=code,
        full_name=data.full_name.strip(),
        password_hash=hash_password(data.password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: uuid.UUID, data: UserUpdate) -> ApplicationUser:
    user = get_user(db, user_id)
    if data.full_name is not None:
        user.full_name = data.full_name.strip()
    if data.role is not None:
        user.role = _validate_role(data.role)
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password is not None:
        user.password_hash = hash_password(data.password)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_admin(
    db: Session, employee_code: str, full_name: str, password: str
) -> tuple[ApplicationUser, bool]:
    """Idempotent first-admin creation used by the seed CLI."""
    existing = db.scalars(
        select(ApplicationUser).where(ApplicationUser.employee_code == employee_code.strip())
    ).first()
    if existing is not None:
        return existing, False
    user = ApplicationUser(
        employee_code=employee_code.strip(),
        full_name=full_name.strip(),
        password_hash=hash_password(password),
        role=UserRole.ADMIN.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True


def reset_password(
    db: Session,
    employee_code: str,
    password: str,
    full_name: str | None = None,
) -> ApplicationUser:
    """Reset the password of an existing user, identified by employee_code.

    Reuses the same :func:`hash_password` helper as login/user creation, so the
    new hash verifies with :func:`verify_password`. The user's ID, role, active
    state and audit relationships are left untouched. ``full_name`` is only
    updated when a non-empty value is supplied. Raises ``NotFoundError`` when no
    user matches, so callers never silently create one.
    """
    if not password:
        raise ValidationAppError("Password is required", code="EMPTY_PASSWORD")
    user = db.scalars(
        select(ApplicationUser).where(
            ApplicationUser.employee_code == employee_code.strip()
        )
    ).first()
    if user is None:
        raise NotFoundError(
            f"No user with employee code '{employee_code.strip()}'"
        )
    user.password_hash = hash_password(password)
    if full_name is not None and full_name.strip():
        user.full_name = full_name.strip()
    db.commit()
    db.refresh(user)
    return user
