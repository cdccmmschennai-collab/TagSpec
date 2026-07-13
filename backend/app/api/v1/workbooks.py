"""Workbook upload, import, tag workflow, and export endpoints (Phases 3-7, 10)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, is_supervisor, require_supervisor
from app.core.database import get_db
from app.core.errors import NotFoundError
from app.models.user import ApplicationUser
from app.schemas.workbook import (
    AssignEquipmentRequest,
    ClaimResponse,
    EquipmentDescriptionCount,
    ExportHistoryOut,
    ImportStats,
    SaveTagRequest,
    TagRowOut,
    UploadResponse,
    ValidationSummary,
    WorkbookJobOut,
)
from app.services import (
    export_service,
    import_service,
    tag_service,
    workbook_service,
)

router = APIRouter(prefix="/workbooks", tags=["workbooks"])


def _validation_summary(job) -> ValidationSummary | None:
    if not job.sheet_name:
        return None
    return ValidationSummary(
        sheet_name=job.sheet_name,
        header_row_number=job.header_row_number,
        tag_column_number=job.tag_column_number,
        equipment_column_number=job.equipment_column_number,
        additional_info_column_number=job.additional_info_column_number,
        detected_headers={
            "TAG NUMBER REV-1": job.tag_column_number,
            "EQUIPMENT DESCRIPTION": job.equipment_column_number,
            "ADDITIONAL INFORMATION": job.additional_info_column_number,
        },
    )


@router.post("", response_model=UploadResponse, status_code=201)
async def upload_workbook(
    file: UploadFile = File(...),
    job_name: str | None = Form(default=None),
    project_code: str | None = Form(default=None),
    revision: str | None = Form(default=None),
    allow_duplicate: bool = Form(default=False),
    user: ApplicationUser = Depends(require_supervisor),
    db: Session = Depends(get_db),
) -> UploadResponse:
    content = await file.read()
    job, _detection, is_dup = workbook_service.create_job_from_upload(
        db,
        content=content,
        original_filename=file.filename or "workbook.xlsx",
        job_name=job_name,
        project_code=project_code,
        revision=revision,
        uploaded_by=user.id,
        allow_duplicate=allow_duplicate,
    )
    return UploadResponse(
        job=WorkbookJobOut.model_validate(job),
        duplicate=is_dup,
        validation=_validation_summary(job),
        message="Duplicate upload — returning existing job" if is_dup else "Uploaded",
    )


@router.get("", response_model=list[WorkbookJobOut])
def list_jobs(
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return workbook_service.list_jobs(db)


@router.get("/{job_id}", response_model=WorkbookJobOut)
def get_job(
    job_id: uuid.UUID,
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return workbook_service.get_job(db, job_id)


@router.get("/{job_id}/validation", response_model=ValidationSummary)
def validation_summary(
    job_id: uuid.UUID,
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = workbook_service.get_job(db, job_id)
    summary = _validation_summary(job)
    if summary is None:
        raise NotFoundError("Job has no validated structure")
    return summary


@router.delete("/{job_id}", status_code=204)
def delete_job(
    job_id: uuid.UUID,
    _: ApplicationUser = Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    workbook_service.delete_job(db, job_id)


# ---- import (Phase 4) ----


@router.post("/{job_id}/import", response_model=ImportStats)
def import_rows(
    job_id: uuid.UUID,
    rerun: bool = Query(default=False),
    _: ApplicationUser = Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    job = workbook_service.get_job(db, job_id)
    return import_service.import_rows(db, job, rerun=rerun)


@router.get("/{job_id}/equipment-descriptions", response_model=list[EquipmentDescriptionCount])
def equipment_descriptions(
    job_id: uuid.UUID,
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return import_service.equipment_description_counts(db, job_id)


@router.get("/{job_id}/unmatched", response_model=list[str])
def unmatched(
    job_id: uuid.UUID,
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return import_service.unmatched_descriptions(db, job_id)


@router.post("/{job_id}/assign-equipment", response_model=dict)
def assign_equipment(
    job_id: uuid.UUID,
    payload: AssignEquipmentRequest,
    _: ApplicationUser = Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    updated = import_service.assign_description_to_template(
        db, job_id, payload.normalized_equipment_description, payload.equipment_template_id
    )
    return {"updated_rows": updated}


# ---- tag workflow (Phases 5-7) ----


@router.get("/{job_id}/tags", response_model=list[TagRowOut])
def list_tags(
    job_id: uuid.UUID,
    equipment: str | None = Query(default=None, description="normalized equipment description"),
    statuses: list[str] | None = Query(default=None),
    user: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return tag_service.list_tags(
        db,
        job_id,
        normalized_equipment=equipment,
        user_id=user.id,
        is_supervisor=is_supervisor(user),
        statuses=statuses,
    )


@router.post("/tags/{tag_id}/claim", response_model=ClaimResponse)
def claim_tag(
    tag_id: uuid.UUID,
    user: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tag = tag_service.claim_tag(db, tag_id, user.id)
    attributes = (
        tag_service.attribute_dicts(db, tag.equipment_template_id)
        if tag.equipment_template_id
        else []
    )
    return ClaimResponse(tag=TagRowOut.model_validate(tag), attributes=attributes)


@router.post("/tags/{tag_id}/heartbeat", response_model=TagRowOut)
def heartbeat(
    tag_id: uuid.UUID,
    user: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return tag_service.heartbeat(db, tag_id, user.id)


@router.post("/tags/{tag_id}/draft", response_model=TagRowOut)
def save_draft(
    tag_id: uuid.UUID,
    payload: SaveTagRequest,
    user: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return tag_service.save_draft(db, tag_id, user.id, payload.values, payload.row_version)


@router.post("/tags/{tag_id}/complete", response_model=TagRowOut)
def complete_tag(
    tag_id: uuid.UUID,
    payload: SaveTagRequest,
    user: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return tag_service.complete_tag(db, tag_id, user.id, payload.values, payload.row_version)


@router.post("/tags/{tag_id}/release", response_model=TagRowOut)
def release_tag(
    tag_id: uuid.UUID,
    user: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return tag_service.release_tag(db, tag_id, user.id)


@router.post("/tags/{tag_id}/force-release", response_model=TagRowOut)
def force_release(
    tag_id: uuid.UUID,
    user: ApplicationUser = Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    return tag_service.force_release(db, tag_id, user.id)


# ---- export (Phase 10) ----


@router.post("/{job_id}/export", response_model=ExportHistoryOut)
def export_job(
    job_id: uuid.UUID,
    user: ApplicationUser = Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    return export_service.export_job(db, job_id, user.id)


@router.get("/{job_id}/exports", response_model=list[ExportHistoryOut])
def list_exports(
    job_id: uuid.UUID,
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return export_service.list_exports(db, job_id)


@router.get("/exports/{export_id}/download")
def download_export(
    export_id: uuid.UUID,
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = export_service.get_export(db, export_id)
    return FileResponse(
        record.output_file_path,
        filename=record.output_filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
