"""Application user model."""

from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import UserRole


class ApplicationUser(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "application_users"

    employee_code: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(32), nullable=False, default=UserRole.EDITOR.value
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
