"""Tag selection, atomic claiming, concurrency, and value saving (Phases 5-7)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, or_, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError, PermissionError_, ValidationAppError
from app.models.enums import HistoryAction, TagStatus
from app.models.equipment import EquipmentAttribute
from app.models.history import TagEntryHistory
from app.models.tag_row import ImportedTagRow
from app.services.formatter import AttributeSpec, build_additional_information, normalize_values

# Statuses an editor may see/select in the pending dropdown for an equipment.
SELECTABLE_FOR_EDITOR = {TagStatus.AVAILABLE.value}


def _now() -> datetime:
    return datetime.now(UTC)


def _expiry() -> datetime:
    return _now() + timedelta(minutes=settings.claim_expiry_minutes)


def get_tag(db: Session, tag_id: uuid.UUID) -> ImportedTagRow:
    tag = db.get(ImportedTagRow, tag_id)
    if tag is None:
        raise NotFoundError("Tag row not found")
    return tag


def _record_history(
    db: Session,
    tag: ImportedTagRow,
    action: HistoryAction,
    user_id: uuid.UUID | None,
    *,
    previous_version: int | None = None,
) -> None:
    db.add(
        TagEntryHistory(
            imported_tag_row_id=tag.id,
            attribute_values_json=tag.attribute_values_json,
            generated_additional_information=tag.generated_additional_information,
            action=action.value,
            changed_by=user_id,
            previous_version=previous_version,
            new_version=tag.row_version,
        )
    )


def list_tags(
    db: Session,
    job_id: uuid.UUID,
    *,
    normalized_equipment: str | None = None,
    user_id: uuid.UUID | None = None,
    is_supervisor: bool = False,
    statuses: list[str] | None = None,
) -> list[ImportedTagRow]:
    """List tags with backend-enforced visibility rules.

    Editors see AVAILABLE tags plus tags they themselves have claimed. They must
    NOT see EXISTING_IN_EXCEL, COMPLETED, TEMPLATE_MISSING, or tags claimed by
    others. Supervisors may pass explicit ``statuses`` to see everything.
    """
    stmt = select(ImportedTagRow).where(ImportedTagRow.workbook_job_id == job_id)
    if normalized_equipment is not None:
        stmt = stmt.where(
            ImportedTagRow.normalized_equipment_description == normalized_equipment
        )

    if is_supervisor:
        if statuses:
            stmt = stmt.where(ImportedTagRow.status.in_(statuses))
    else:
        stmt = stmt.where(
            or_(
                ImportedTagRow.status == TagStatus.AVAILABLE.value,
                and_(
                    ImportedTagRow.status.in_(
                        [TagStatus.CLAIMED.value, TagStatus.DRAFT.value]
                    ),
                    ImportedTagRow.claimed_by == user_id,
                ),
            )
        )
    stmt = stmt.order_by(ImportedTagRow.excel_row_number)
    return list(db.scalars(stmt).all())


def _attribute_specs(db: Session, template_id: uuid.UUID) -> list[AttributeSpec]:
    attrs = db.scalars(
        select(EquipmentAttribute)
        .where(
            EquipmentAttribute.equipment_template_id == template_id,
            EquipmentAttribute.is_active.is_(True),
        )
        .order_by(EquipmentAttribute.display_order)
    ).all()
    return [
        AttributeSpec(a.attribute_name, a.display_order, a.is_required) for a in attrs
    ]


def attribute_dicts(db: Session, template_id: uuid.UUID) -> list[dict]:
    attrs = db.scalars(
        select(EquipmentAttribute)
        .where(
            EquipmentAttribute.equipment_template_id == template_id,
            EquipmentAttribute.is_active.is_(True),
        )
        .order_by(EquipmentAttribute.display_order)
    ).all()
    return [
        {
            "id": str(a.id),
            "attribute_name": a.attribute_name,
            "display_label": a.display_label,
            "display_order": a.display_order,
            "is_required": a.is_required,
            "placeholder": a.placeholder,
        }
        for a in attrs
    ]


# ------------------------------------------------------------------- claiming ---


def claim_tag(db: Session, tag_id: uuid.UUID, user_id: uuid.UUID) -> ImportedTagRow:
    """Atomically claim an AVAILABLE (or expired) tag. One winner guaranteed."""
    now = _now()
    stmt = (
        update(ImportedTagRow)
        .where(
            ImportedTagRow.id == tag_id,
            or_(
                ImportedTagRow.status == TagStatus.AVAILABLE.value,
                and_(
                    ImportedTagRow.status.in_(
                        [TagStatus.CLAIMED.value, TagStatus.DRAFT.value]
                    ),
                    ImportedTagRow.claim_expires_at.isnot(None),
                    ImportedTagRow.claim_expires_at <= now,
                ),
            ),
        )
        .values(
            status=TagStatus.CLAIMED.value,
            claimed_by=user_id,
            claimed_at=now,
            last_heartbeat_at=now,
            claim_expires_at=now + timedelta(minutes=settings.claim_expiry_minutes),
            row_version=ImportedTagRow.row_version + 1,
        )
        .returning(ImportedTagRow.id)
    )
    result = db.execute(stmt)
    won = result.first()
    if won is None:
        db.rollback()
        _raise_claim_failure(db, tag_id, user_id)

    db.commit()
    tag = get_tag(db, tag_id)
    _record_history(db, tag, HistoryAction.CLAIMED, user_id)
    db.commit()
    return tag


def _raise_claim_failure(db: Session, tag_id: uuid.UUID, user_id: uuid.UUID) -> None:
    tag = db.get(ImportedTagRow, tag_id)
    if tag is None:
        raise NotFoundError("Tag row not found")
    if tag.status in {TagStatus.COMPLETED.value, TagStatus.EXPORTED.value}:
        raise ConflictError("Tag already completed", code="TAG_ALREADY_COMPLETED")
    if tag.status == TagStatus.EXISTING_IN_EXCEL.value:
        raise ConflictError(
            "Tag already has data in Excel", code="TAG_EXISTING_IN_EXCEL"
        )
    if tag.status == TagStatus.TEMPLATE_MISSING.value:
        raise ConflictError("No equipment template for this tag", code="TEMPLATE_MISSING")
    if tag.claimed_by == user_id:
        # Already ours — treat as success upstream by returning; but here raise soft.
        raise ConflictError("Tag already claimed by you", code="TAG_ALREADY_CLAIMED_SELF")
    raise ConflictError("Tag already claimed by another employee", code="TAG_ALREADY_CLAIMED")


def _owned_locked_tag(db: Session, tag_id: uuid.UUID, user_id: uuid.UUID) -> ImportedTagRow:
    """Load a tag with a row lock and verify current-user ownership + freshness."""
    tag = db.scalars(
        select(ImportedTagRow).where(ImportedTagRow.id == tag_id).with_for_update()
    ).first()
    if tag is None:
        raise NotFoundError("Tag row not found")
    if tag.status in {TagStatus.COMPLETED.value, TagStatus.EXPORTED.value}:
        raise ConflictError("Tag already completed", code="TAG_ALREADY_COMPLETED")
    if tag.claimed_by != user_id:
        raise PermissionError_("Tag is not claimed by you", code="TAG_NOT_OWNED")
    if tag.claim_expires_at is not None and tag.claim_expires_at < _now():
        raise ConflictError("Your claim has expired", code="TAG_CLAIM_EXPIRED")
    return tag


def heartbeat(db: Session, tag_id: uuid.UUID, user_id: uuid.UUID) -> ImportedTagRow:
    tag = _owned_locked_tag(db, tag_id, user_id)
    now = _now()
    tag.last_heartbeat_at = now
    tag.claim_expires_at = now + timedelta(minutes=settings.claim_expiry_minutes)
    db.commit()
    db.refresh(tag)
    return tag


def _check_version(tag: ImportedTagRow, expected: int) -> None:
    if tag.row_version != expected:
        raise ConflictError(
            f"Tag was modified (expected v{expected}, found v{tag.row_version})",
            code="STALE_TAG_VERSION",
        )


def save_draft(
    db: Session,
    tag_id: uuid.UUID,
    user_id: uuid.UUID,
    values: dict[str, str],
    row_version: int,
) -> ImportedTagRow:
    tag = _owned_locked_tag(db, tag_id, user_id)
    _check_version(tag, row_version)
    previous = tag.row_version

    tag.attribute_values_json = normalize_values(values)
    # Draft may leave required fields blank; still generate a best-effort preview.
    if tag.equipment_template_id is not None:
        specs = _attribute_specs(db, tag.equipment_template_id)
        try:
            tag.generated_additional_information = build_additional_information(
                specs, tag.attribute_values_json, require_all=False
            )
        except ValidationAppError:
            tag.generated_additional_information = None

    tag.status = TagStatus.DRAFT.value
    now = _now()
    tag.last_heartbeat_at = now
    tag.claim_expires_at = now + timedelta(minutes=settings.claim_expiry_minutes)
    tag.row_version = previous + 1
    _record_history(db, tag, HistoryAction.DRAFT_SAVED, user_id, previous_version=previous)
    db.commit()
    db.refresh(tag)
    return tag


def complete_tag(
    db: Session,
    tag_id: uuid.UUID,
    user_id: uuid.UUID,
    values: dict[str, str],
    row_version: int,
) -> ImportedTagRow:
    tag = _owned_locked_tag(db, tag_id, user_id)
    _check_version(tag, row_version)
    if tag.equipment_template_id is None:
        raise ValidationAppError("Tag has no equipment template", code="TEMPLATE_MISSING")

    previous = tag.row_version
    normalized = normalize_values(values)
    specs = _attribute_specs(db, tag.equipment_template_id)
    generated = build_additional_information(specs, normalized, require_all=True)

    tag.attribute_values_json = normalized
    tag.generated_additional_information = generated
    tag.status = TagStatus.COMPLETED.value
    tag.completed_by = user_id
    tag.completed_at = _now()
    tag.claimed_by = None
    tag.claimed_at = None
    tag.claim_expires_at = None
    tag.last_heartbeat_at = None
    tag.row_version = previous + 1
    _record_history(db, tag, HistoryAction.COMPLETED, user_id, previous_version=previous)
    db.commit()
    db.refresh(tag)
    return tag


def release_tag(db: Session, tag_id: uuid.UUID, user_id: uuid.UUID) -> ImportedTagRow:
    """Owner releases a tag back to AVAILABLE, preserving any saved draft values."""
    tag = _owned_locked_tag(db, tag_id, user_id)
    previous = tag.row_version
    tag.status = TagStatus.AVAILABLE.value
    tag.claimed_by = None
    tag.claimed_at = None
    tag.claim_expires_at = None
    tag.last_heartbeat_at = None
    tag.row_version = previous + 1
    _record_history(db, tag, HistoryAction.RELEASED, user_id, previous_version=previous)
    db.commit()
    db.refresh(tag)
    return tag


def force_release(db: Session, tag_id: uuid.UUID, supervisor_id: uuid.UUID) -> ImportedTagRow:
    """Supervisor force-releases any claimed/draft tag back to AVAILABLE."""
    tag = db.scalars(
        select(ImportedTagRow).where(ImportedTagRow.id == tag_id).with_for_update()
    ).first()
    if tag is None:
        raise NotFoundError("Tag row not found")
    if tag.status not in {TagStatus.CLAIMED.value, TagStatus.DRAFT.value}:
        raise ConflictError(
            "Only claimed or draft tags can be force-released",
            code="TAG_NOT_CLAIMED",
        )
    previous = tag.row_version
    tag.status = TagStatus.AVAILABLE.value
    tag.claimed_by = None
    tag.claimed_at = None
    tag.claim_expires_at = None
    tag.last_heartbeat_at = None
    tag.row_version = previous + 1
    _record_history(db, tag, HistoryAction.FORCE_RELEASED, supervisor_id, previous_version=previous)
    db.commit()
    db.refresh(tag)
    return tag


def expire_stale_claims(db: Session, job_id: uuid.UUID | None = None) -> int:
    """Return expired claimed/draft tags to AVAILABLE. Returns count changed."""
    now = _now()
    stmt = (
        update(ImportedTagRow)
        .where(
            ImportedTagRow.status.in_([TagStatus.CLAIMED.value, TagStatus.DRAFT.value]),
            ImportedTagRow.claim_expires_at.isnot(None),
            ImportedTagRow.claim_expires_at < now,
        )
        .values(
            status=TagStatus.AVAILABLE.value,
            claimed_by=None,
            claimed_at=None,
            claim_expires_at=None,
            last_heartbeat_at=None,
        )
    )
    if job_id is not None:
        stmt = stmt.where(ImportedTagRow.workbook_job_id == job_id)
    result = db.execute(stmt)
    db.commit()
    return result.rowcount or 0
