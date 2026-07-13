"""Export history model."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDMixin
from app.models.enums import ExportStatus


class ExportHistory(UUIDMixin, Base):
    __tablename__ = "export_history"

    workbook_job_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workbook_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    output_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    output_file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    row_count_written: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generated_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("application_users.id", ondelete="SET NULL")
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    file_hash: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ExportStatus.PENDING.value
    )
    error_message: Mapped[str | None] = mapped_column(Text)
