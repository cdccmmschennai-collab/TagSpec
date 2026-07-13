"""Equipment master schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AttributeCreate(BaseModel):
    attribute_name: str = Field(min_length=1, max_length=255)
    display_label: str | None = None
    display_order: int | None = None
    is_required: bool = True
    placeholder: str | None = None
    is_active: bool = True


class AttributeUpdate(BaseModel):
    attribute_name: str | None = Field(default=None, min_length=1, max_length=255)
    display_label: str | None = None
    display_order: int | None = None
    is_required: bool | None = None
    placeholder: str | None = None
    is_active: bool | None = None


class AttributeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    equipment_template_id: uuid.UUID
    attribute_name: str
    display_label: str
    display_order: int
    is_required: bool
    placeholder: str | None
    is_active: bool


class AttributeReorderItem(BaseModel):
    id: uuid.UUID
    display_order: int


class AttributeReorderRequest(BaseModel):
    items: list[AttributeReorderItem]


class AliasCreate(BaseModel):
    alias: str = Field(min_length=1, max_length=512)


class AliasOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    equipment_template_id: uuid.UUID
    alias: str
    normalized_alias: str
    created_at: datetime


class EquipmentCreate(BaseModel):
    equipment_description: str = Field(min_length=1, max_length=512)
    equipment_code: str | None = None
    is_active: bool = True
    attributes: list[AttributeCreate] = Field(default_factory=list)


class EquipmentUpdate(BaseModel):
    equipment_description: str | None = Field(default=None, min_length=1, max_length=512)
    equipment_code: str | None = None
    is_active: bool | None = None


class EquipmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    equipment_code: str | None
    equipment_description: str
    normalized_description: str
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EquipmentDetailOut(EquipmentOut):
    attributes: list[AttributeOut] = Field(default_factory=list)
    aliases: list[AliasOut] = Field(default_factory=list)
