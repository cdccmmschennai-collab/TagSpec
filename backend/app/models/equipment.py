"""Equipment master models: templates, aliases and attributes."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class EquipmentTemplate(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "equipment_templates"
    __table_args__ = (
        UniqueConstraint("normalized_description", name="uq_equipment_normalized_desc"),
    )

    equipment_code: Mapped[str | None] = mapped_column(String(64), index=True)
    equipment_description: Mapped[str] = mapped_column(String(512), nullable=False)
    normalized_description: Mapped[str] = mapped_column(
        String(512), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    aliases: Mapped[list["EquipmentAlias"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
    )
    attributes: Mapped[list["EquipmentAttribute"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="EquipmentAttribute.display_order",
    )


class EquipmentAlias(UUIDMixin, Base):
    __tablename__ = "equipment_aliases"
    __table_args__ = (
        UniqueConstraint("normalized_alias", name="uq_equipment_normalized_alias"),
    )

    equipment_template_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    alias: Mapped[str] = mapped_column(String(512), nullable=False)
    normalized_alias: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    template: Mapped[EquipmentTemplate] = relationship(back_populates="aliases")


class EquipmentAttribute(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "equipment_attributes"
    __table_args__ = (
        UniqueConstraint(
            "equipment_template_id",
            "attribute_name",
            name="uq_attribute_name_per_template",
        ),
    )

    equipment_template_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attribute_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_label: Mapped[str] = mapped_column(String(255), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    placeholder: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    template: Mapped[EquipmentTemplate] = relationship(back_populates="attributes")
