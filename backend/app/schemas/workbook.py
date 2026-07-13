"""Workbook and tag schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkbookJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_name: str
    project_code: str | None
    revision: str | None
    original_filename: str
    stored_filename: str
    file_hash: str
    file_size: int
    sheet_name: str | None
    header_row_number: int | None
    tag_column_number: int | None
    equipment_column_number: int | None
    additional_info_column_number: int | None
    status: str
    uploaded_by: uuid.UUID | None
    uploaded_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ValidationSummary(BaseModel):
    sheet_name: str
    header_row_number: int
    tag_column_number: int
    equipment_column_number: int
    additional_info_column_number: int
    detected_headers: dict[str, int]
    missing_columns: list[str] = Field(default_factory=list)


class UploadResponse(BaseModel):
    job: WorkbookJobOut
    duplicate: bool = False
    validation: ValidationSummary | None = None
    message: str | None = None


class ImportStats(BaseModel):
    total_rows_inspected: int
    total_tag_rows: int
    equipment_description_count: int
    matched_equipment_count: int
    unmatched_equipment_count: int
    available_tags: int
    template_missing_tags: int
    existing_in_excel_tags: int
    duplicate_tag_numbers: list[str] = Field(default_factory=list)


class EquipmentDescriptionCount(BaseModel):
    equipment_description: str
    normalized_equipment_description: str
    equipment_template_id: uuid.UUID | None
    total: int
    available: int
    in_progress: int
    completed: int
    existing_in_excel: int
    template_missing: int


class TagRowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workbook_job_id: uuid.UUID
    sheet_name: str
    excel_row_number: int
    tag_number: str | None
    revision: str | None
    equipment_description: str | None
    equipment_template_id: uuid.UUID | None
    original_additional_information: str | None
    attribute_values_json: dict | None
    generated_additional_information: str | None
    status: str
    claimed_by: uuid.UUID | None
    claimed_at: datetime | None
    claim_expires_at: datetime | None
    completed_by: uuid.UUID | None
    completed_at: datetime | None
    row_version: int


class ClaimResponse(BaseModel):
    tag: TagRowOut
    attributes: list[dict]


class SaveTagRequest(BaseModel):
    values: dict[str, str]
    row_version: int


class AssignEquipmentRequest(BaseModel):
    normalized_equipment_description: str
    equipment_template_id: uuid.UUID


class ExportHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workbook_job_id: uuid.UUID
    output_filename: str
    row_count_written: int
    generated_by: uuid.UUID | None
    generated_at: datetime
    file_hash: str | None
    status: str
    error_message: str | None
