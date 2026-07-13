"""Workbook job model — one uploaded Excel workbook per job."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin
from app.models.enums import JobStatus


class WorkbookJob(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "workbook_jobs"

    job_name: Mapped[str] = mapped_column(String(255), nullable=False)
    project_code: Mapped[str | None] = mapped_column(String(64), index=True)
    revision: Mapped[str | None] = mapped_column(String(64))

    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    original_file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)

    sheet_name: Mapped[str | None] = mapped_column(String(255))
    header_row_number: Mapped[int | None] = mapped_column(Integer)
    tag_column_number: Mapped[int | None] = mapped_column(Integer)
    equipment_column_number: Mapped[int | None] = mapped_column(Integer)
    additional_info_column_number: Mapped[int | None] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=JobStatus.UPLOADED.value, index=True
    )

    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("application_users.id", ondelete="SET NULL"),
    )
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
