"""Audit history for tag entry actions."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin


class TagEntryHistory(UUIDMixin, Base):
    __tablename__ = "tag_entry_history"

    imported_tag_row_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("imported_tag_rows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attribute_values_json: Mapped[dict | None] = mapped_column(JSONB)
    generated_additional_information: Mapped[str | None] = mapped_column(Text)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("application_users.id", ondelete="SET NULL")
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    previous_version: Mapped[int | None] = mapped_column(Integer)
    new_version: Mapped[int | None] = mapped_column(Integer)
