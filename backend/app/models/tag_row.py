"""Imported tag row model — one candidate Excel row per record."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import TagStatus


class ImportedTagRow(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "imported_tag_rows"
    __table_args__ = (
        UniqueConstraint(
            "workbook_job_id",
            "sheet_name",
            "excel_row_number",
            name="uq_tag_row_per_workbook_cell",
        ),
        Index("ix_tag_job_status", "workbook_job_id", "status"),
        Index("ix_tag_job_equipment", "workbook_job_id", "normalized_equipment_description"),
        Index("ix_tag_claimed_by", "claimed_by"),
    )

    workbook_job_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workbook_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sheet_name: Mapped[str] = mapped_column(String(255), nullable=False)
    excel_row_number: Mapped[int] = mapped_column(Integer, nullable=False)

    tag_number: Mapped[str | None] = mapped_column(String(512))
    normalized_tag_number: Mapped[str | None] = mapped_column(String(512), index=True)
    revision: Mapped[str | None] = mapped_column(String(64))

    equipment_description: Mapped[str | None] = mapped_column(String(512))
    normalized_equipment_description: Mapped[str | None] = mapped_column(String(512))
    equipment_template_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_templates.id", ondelete="SET NULL"),
    )

    original_additional_information: Mapped[str | None] = mapped_column(Text)
    attribute_values_json: Mapped[dict | None] = mapped_column(JSONB)
    generated_additional_information: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=TagStatus.AVAILABLE.value, index=True
    )

    claimed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("application_users.id", ondelete="SET NULL")
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    claim_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    completed_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("application_users.id", ondelete="SET NULL")
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    row_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
