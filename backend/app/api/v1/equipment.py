"""Equipment master endpoints (Phase 2)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.database import get_db
from app.models.user import ApplicationUser
from app.schemas.equipment import (
    AliasCreate,
    AliasOut,
    AttributeCreate,
    AttributeOut,
    AttributeReorderRequest,
    AttributeUpdate,
    EquipmentCreate,
    EquipmentDetailOut,
    EquipmentOut,
    EquipmentUpdate,
)
from app.services import equipment_service

router = APIRouter(prefix="/equipment", tags=["equipment"])


@router.get("", response_model=list[EquipmentDetailOut])
def list_equipment(
    include_inactive: bool = Query(default=True),
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return equipment_service.list_equipment(db, include_inactive=include_inactive)


@router.get("/{equipment_id}", response_model=EquipmentDetailOut)
def get_equipment(
    equipment_id: uuid.UUID,
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return equipment_service.get_equipment(db, equipment_id)


@router.post("", response_model=EquipmentDetailOut, status_code=201)
def create_equipment(
    payload: EquipmentCreate,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return equipment_service.create_equipment(db, payload)


@router.patch("/{equipment_id}", response_model=EquipmentDetailOut)
def update_equipment(
    equipment_id: uuid.UUID,
    payload: EquipmentUpdate,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return equipment_service.update_equipment(db, equipment_id, payload)


@router.post("/{equipment_id}/activate", response_model=EquipmentOut)
def activate(
    equipment_id: uuid.UUID,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return equipment_service.set_active(db, equipment_id, True)


@router.post("/{equipment_id}/deactivate", response_model=EquipmentOut)
def deactivate(
    equipment_id: uuid.UUID,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return equipment_service.set_active(db, equipment_id, False)


# ---- aliases ----


@router.post("/{equipment_id}/aliases", response_model=AliasOut, status_code=201)
def add_alias(
    equipment_id: uuid.UUID,
    payload: AliasCreate,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return equipment_service.add_alias(db, equipment_id, payload)


@router.delete("/aliases/{alias_id}", status_code=204)
def delete_alias(
    alias_id: uuid.UUID,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    equipment_service.delete_alias(db, alias_id)


# ---- attributes ----


@router.get("/{equipment_id}/attributes", response_model=list[AttributeOut])
def list_attributes(
    equipment_id: uuid.UUID,
    active_only: bool = Query(default=False),
    _: ApplicationUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return equipment_service.list_attributes(db, equipment_id, active_only=active_only)


@router.post("/{equipment_id}/attributes", response_model=AttributeOut, status_code=201)
def create_attribute(
    equipment_id: uuid.UUID,
    payload: AttributeCreate,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return equipment_service.create_attribute(db, equipment_id, payload)


@router.patch("/attributes/{attribute_id}", response_model=AttributeOut)
def update_attribute(
    attribute_id: uuid.UUID,
    payload: AttributeUpdate,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return equipment_service.update_attribute(db, attribute_id, payload)


@router.post("/{equipment_id}/attributes/reorder", response_model=list[AttributeOut])
def reorder_attributes(
    equipment_id: uuid.UUID,
    payload: AttributeReorderRequest,
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return equipment_service.reorder_attributes(db, equipment_id, payload.items)


@router.delete("/attributes/{attribute_id}", status_code=204)
def delete_attribute(
    attribute_id: uuid.UUID,
    hard: bool = Query(default=False),
    _: ApplicationUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    equipment_service.delete_attribute(db, attribute_id, hard=hard)
