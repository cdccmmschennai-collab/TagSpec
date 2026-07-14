"""Tests for the admin password-reset path (auth_service.reset_password)."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.core.errors import NotFoundError, ValidationAppError
from app.core.security import verify_password
from app.models.user import ApplicationUser
from app.schemas.auth import UserCreate
from app.services import auth_service


def _make_admin(db, code="ADM001", password="oldpass1", full_name="Original Admin"):
    return auth_service.create_user(
        db,
        UserCreate(
            employee_code=code, full_name=full_name, password=password, role="ADMIN"
        ),
    )


def _user_count(db) -> int:
    return db.scalar(select(func.count()).select_from(ApplicationUser))


def test_create_only_leaves_existing_user_unchanged(db):
    """Without --reset-password, get_or_create_admin must not touch the user."""
    user = _make_admin(db)
    original_hash = user.password_hash
    original_id = user.id

    got, created = auth_service.get_or_create_admin(
        db, "ADM001", "Different Name", "brandnewpass"
    )

    assert created is False
    assert got.id == original_id
    assert got.password_hash == original_hash
    assert got.full_name == "Original Admin"
    assert verify_password("oldpass1", got.password_hash)


def test_reset_replaces_password_and_preserves_identity(db):
    user = _make_admin(db)
    original_hash = user.password_hash
    original_id = user.id
    original_role = user.role

    updated = auth_service.reset_password(db, "ADM001", "newsecret9")

    # Identity, role and active state are preserved.
    assert updated.id == original_id
    assert updated.role == original_role
    assert updated.is_active is True
    # The stored hash actually changed.
    assert updated.password_hash != original_hash


def test_reset_new_password_verifies_and_old_password_fails(db):
    _make_admin(db)

    auth_service.reset_password(db, "ADM001", "newsecret9")

    user = db.scalars(
        select(ApplicationUser).where(ApplicationUser.employee_code == "ADM001")
    ).first()
    # New password passes the exact verifier used by login...
    assert verify_password("newsecret9", user.password_hash)
    # ...and the old one no longer works.
    assert not verify_password("oldpass1", user.password_hash)


def test_reset_new_password_authenticates_via_login_path(db):
    """End-to-end: authenticate() (used by /login) accepts the new password."""
    _make_admin(db)

    auth_service.reset_password(db, "ADM001", "newsecret9")

    authed = auth_service.authenticate(db, "ADM001", "newsecret9")
    assert authed.employee_code == "ADM001"
    with pytest.raises(Exception):
        auth_service.authenticate(db, "ADM001", "oldpass1")


def test_reset_does_not_create_duplicate_user(db):
    _make_admin(db)
    assert _user_count(db) == 1

    auth_service.reset_password(db, "ADM001", "newsecret9")

    assert _user_count(db) == 1


def test_reset_missing_user_errors_without_creating(db):
    assert _user_count(db) == 0
    with pytest.raises(NotFoundError):
        auth_service.reset_password(db, "NOPE001", "newsecret9")
    assert _user_count(db) == 0


def test_reset_rejects_empty_password(db):
    _make_admin(db)
    with pytest.raises(ValidationAppError):
        auth_service.reset_password(db, "ADM001", "")


def test_reset_updates_full_name_only_when_provided(db):
    _make_admin(db, full_name="Original Admin")

    auth_service.reset_password(db, "ADM001", "newsecret9")
    user = db.scalars(
        select(ApplicationUser).where(ApplicationUser.employee_code == "ADM001")
    ).first()
    assert user.full_name == "Original Admin"

    auth_service.reset_password(db, "ADM001", "newsecret9", full_name="Renamed Admin")
    db.refresh(user)
    assert user.full_name == "Renamed Admin"
