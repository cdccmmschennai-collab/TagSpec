"""Reusable seed helpers (Ball Valve master example).

The Ball Valve example is seed *data*, created through the normal service layer.
It is intentionally NOT hardcoded anywhere in the frontend — forms are always
generated from the equipment attribute master.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.normalization import normalize_equipment_description
from app.models.equipment import EquipmentTemplate
from app.schemas.equipment import AttributeCreate, EquipmentCreate
from app.services import equipment_service

BALL_VALVE_ATTRIBUTES = [
    "BODY",
    "SEAT",
    "STEM",
    "BALL",
    "OPERATING PRESSURE",
    "OPERATING TEMPERATURE",
    "STANDARD",
    "FLANGE STANDARD",
]


def seed_ball_valve(db: Session) -> EquipmentTemplate:
    """Create the BALL VALVE template if it does not already exist."""
    normalized = normalize_equipment_description("BALL VALVE")
    existing = equipment_service.match_equipment(db, normalized)
    if existing is not None:
        return existing

    data = EquipmentCreate(
        equipment_description="BALL VALVE",
        equipment_code="BALL-VALVE",
        is_active=True,
        attributes=[
            AttributeCreate(
                attribute_name=name,
                display_label=name,
                display_order=index + 1,
                is_required=True,
            )
            for index, name in enumerate(BALL_VALVE_ATTRIBUTES)
        ],
    )
    return equipment_service.create_equipment(db, data)
