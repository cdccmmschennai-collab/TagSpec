"""Equipment master business logic: templates, aliases, attributes, matching."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.normalization import normalize_equipment_description
from app.models.equipment import EquipmentAlias, EquipmentAttribute, EquipmentTemplate
from app.schemas.equipment import (
    AliasCreate,
    AttributeCreate,
    AttributeReorderItem,
    AttributeUpdate,
    EquipmentCreate,
    EquipmentUpdate,
)


# ---------------------------------------------------------------- templates ---


def list_equipment(db: Session, *, include_inactive: bool = True) -> list[EquipmentTemplate]:
    stmt = select(EquipmentTemplate).options(
        selectinload(EquipmentTemplate.attributes),
        selectinload(EquipmentTemplate.aliases),
    )
    if not include_inactive:
        stmt = stmt.where(EquipmentTemplate.is_active.is_(True))
    stmt = stmt.order_by(EquipmentTemplate.equipment_description)
    return list(db.scalars(stmt).all())


def get_equipment(db: Session, equipment_id: uuid.UUID) -> EquipmentTemplate:
    template = db.get(EquipmentTemplate, equipment_id)
    if template is None:
        raise NotFoundError("Equipment template not found")
    return template


def _alias_or_description_conflict(db: Session, normalized: str, exclude_id: uuid.UUID | None = None) -> None:
    """Raise if a normalized value collides with an existing description or alias."""
    desc_stmt = select(EquipmentTemplate).where(
        EquipmentTemplate.normalized_description == normalized
    )
    if exclude_id is not None:
        desc_stmt = desc_stmt.where(EquipmentTemplate.id != exclude_id)
    if db.scalars(desc_stmt).first() is not None:
        raise ConflictError(
            f"An equipment with description '{normalized}' already exists",
            code="DUPLICATE_EQUIPMENT_DESCRIPTION",
        )
    if db.scalars(
        select(EquipmentAlias).where(EquipmentAlias.normalized_alias == normalized)
    ).first() is not None:
        raise ConflictError(
            f"'{normalized}' conflicts with an existing alias",
            code="ALIAS_CONFLICT",
        )


def create_equipment(db: Session, data: EquipmentCreate) -> EquipmentTemplate:
    normalized = normalize_equipment_description(data.equipment_description)
    if not normalized:
        raise ValidationAppError("Equipment description cannot be blank")
    _alias_or_description_conflict(db, normalized)

    template = EquipmentTemplate(
        equipment_code=data.equipment_code,
        equipment_description=data.equipment_description.strip(),
        normalized_description=normalized,
        is_active=data.is_active,
        version=1,
    )
    db.add(template)
    db.flush()

    for index, attr in enumerate(data.attributes):
        _add_attribute(db, template, attr, default_order=index + 1)

    db.commit()
    db.refresh(template)
    return template


def update_equipment(db: Session, equipment_id: uuid.UUID, data: EquipmentUpdate) -> EquipmentTemplate:
    template = get_equipment(db, equipment_id)

    if data.equipment_description is not None:
        normalized = normalize_equipment_description(data.equipment_description)
        if not normalized:
            raise ValidationAppError("Equipment description cannot be blank")
        if normalized != template.normalized_description:
            _alias_or_description_conflict(db, normalized, exclude_id=template.id)
        template.equipment_description = data.equipment_description.strip()
        template.normalized_description = normalized

    if data.equipment_code is not None:
        template.equipment_code = data.equipment_code
    if data.is_active is not None:
        template.is_active = data.is_active

    db.commit()
    db.refresh(template)
    return template


def set_active(db: Session, equipment_id: uuid.UUID, active: bool) -> EquipmentTemplate:
    template = get_equipment(db, equipment_id)
    template.is_active = active
    db.commit()
    db.refresh(template)
    return template


# ------------------------------------------------------------------ aliases ---


def add_alias(db: Session, equipment_id: uuid.UUID, data: AliasCreate) -> EquipmentAlias:
    template = get_equipment(db, equipment_id)
    normalized = normalize_equipment_description(data.alias)
    if not normalized:
        raise ValidationAppError("Alias cannot be blank")

    # Alias must not duplicate an existing alias or any equipment description.
    if db.scalars(
        select(EquipmentAlias).where(EquipmentAlias.normalized_alias == normalized)
    ).first() is not None:
        raise ConflictError("Alias already exists", code="DUPLICATE_ALIAS")
    if db.scalars(
        select(EquipmentTemplate).where(
            EquipmentTemplate.normalized_description == normalized
        )
    ).first() is not None:
        raise ConflictError(
            "Alias conflicts with an existing equipment description",
            code="ALIAS_CONFLICT",
        )

    alias = EquipmentAlias(
        equipment_template_id=template.id,
        alias=data.alias.strip(),
        normalized_alias=normalized,
    )
    db.add(alias)
    db.commit()
    db.refresh(alias)
    return alias


def delete_alias(db: Session, alias_id: uuid.UUID) -> None:
    alias = db.get(EquipmentAlias, alias_id)
    if alias is None:
        raise NotFoundError("Alias not found")
    db.delete(alias)
    db.commit()


# --------------------------------------------------------------- attributes ---


def _next_display_order(db: Session, template_id: uuid.UUID) -> int:
    orders = db.scalars(
        select(EquipmentAttribute.display_order).where(
            EquipmentAttribute.equipment_template_id == template_id
        )
    ).all()
    return (max(orders) + 1) if orders else 1


def _add_attribute(
    db: Session,
    template: EquipmentTemplate,
    data: AttributeCreate,
    *,
    default_order: int | None = None,
) -> EquipmentAttribute:
    name = data.attribute_name.strip().upper()
    if not name:
        raise ValidationAppError("Attribute name cannot be blank")

    exists = db.scalars(
        select(EquipmentAttribute).where(
            EquipmentAttribute.equipment_template_id == template.id,
            EquipmentAttribute.attribute_name == name,
        )
    ).first()
    if exists is not None:
        raise ConflictError(
            f"Attribute '{name}' already exists for this equipment",
            code="DUPLICATE_ATTRIBUTE",
        )

    order = data.display_order
    if order is None:
        order = default_order if default_order is not None else _next_display_order(db, template.id)

    # Resolve duplicate display order by shifting existing ones down.
    _shift_orders_for_insert(db, template.id, order)

    attribute = EquipmentAttribute(
        equipment_template_id=template.id,
        attribute_name=name,
        display_label=(data.display_label or name).strip(),
        display_order=order,
        is_required=data.is_required,
        placeholder=data.placeholder,
        is_active=data.is_active,
    )
    db.add(attribute)
    db.flush()
    return attribute


def _shift_orders_for_insert(db: Session, template_id: uuid.UUID, order: int) -> None:
    clashes = db.scalars(
        select(EquipmentAttribute)
        .where(
            EquipmentAttribute.equipment_template_id == template_id,
            EquipmentAttribute.display_order >= order,
        )
        .order_by(EquipmentAttribute.display_order.desc())
    ).all()
    for attr in clashes:
        attr.display_order += 1
    db.flush()


def create_attribute(db: Session, equipment_id: uuid.UUID, data: AttributeCreate) -> EquipmentAttribute:
    template = get_equipment(db, equipment_id)
    attribute = _add_attribute(db, template, data)
    db.commit()
    db.refresh(attribute)
    return attribute


def list_attributes(db: Session, equipment_id: uuid.UUID, *, active_only: bool = False) -> list[EquipmentAttribute]:
    get_equipment(db, equipment_id)
    stmt = select(EquipmentAttribute).where(
        EquipmentAttribute.equipment_template_id == equipment_id
    )
    if active_only:
        stmt = stmt.where(EquipmentAttribute.is_active.is_(True))
    stmt = stmt.order_by(EquipmentAttribute.display_order)
    return list(db.scalars(stmt).all())


def update_attribute(db: Session, attribute_id: uuid.UUID, data: AttributeUpdate) -> EquipmentAttribute:
    attribute = db.get(EquipmentAttribute, attribute_id)
    if attribute is None:
        raise NotFoundError("Attribute not found")

    if data.attribute_name is not None:
        new_name = data.attribute_name.strip().upper()
        if new_name != attribute.attribute_name:
            clash = db.scalars(
                select(EquipmentAttribute).where(
                    EquipmentAttribute.equipment_template_id == attribute.equipment_template_id,
                    EquipmentAttribute.attribute_name == new_name,
                    EquipmentAttribute.id != attribute.id,
                )
            ).first()
            if clash is not None:
                raise ConflictError("Attribute name already exists", code="DUPLICATE_ATTRIBUTE")
        attribute.attribute_name = new_name

    if data.display_label is not None:
        attribute.display_label = data.display_label.strip()
    if data.display_order is not None:
        attribute.display_order = data.display_order
    if data.is_required is not None:
        attribute.is_required = data.is_required
    if data.placeholder is not None:
        attribute.placeholder = data.placeholder
    if data.is_active is not None:
        attribute.is_active = data.is_active

    db.commit()
    db.refresh(attribute)
    return attribute


def reorder_attributes(
    db: Session, equipment_id: uuid.UUID, items: list[AttributeReorderItem]
) -> list[EquipmentAttribute]:
    get_equipment(db, equipment_id)
    by_id = {
        a.id: a
        for a in db.scalars(
            select(EquipmentAttribute).where(
                EquipmentAttribute.equipment_template_id == equipment_id
            )
        ).all()
    }
    # Two-phase to avoid transient unique clashes: offset then set final values.
    for item in items:
        attr = by_id.get(item.id)
        if attr is None:
            raise NotFoundError(f"Attribute {item.id} not in this equipment")
        attr.display_order = item.display_order + 100000
    db.flush()
    for item in items:
        by_id[item.id].display_order = item.display_order
    db.commit()
    return list_attributes(db, equipment_id)


def delete_attribute(db: Session, attribute_id: uuid.UUID, *, hard: bool = False) -> None:
    attribute = db.get(EquipmentAttribute, attribute_id)
    if attribute is None:
        raise NotFoundError("Attribute not found")
    if hard:
        db.delete(attribute)
    else:
        attribute.is_active = False
    db.commit()


# ------------------------------------------------------------------ matching ---


def match_equipment(db: Session, normalized_description: str) -> EquipmentTemplate | None:
    """Match by normalized description first, then by normalized alias."""
    if not normalized_description:
        return None
    template = db.scalars(
        select(EquipmentTemplate).where(
            EquipmentTemplate.normalized_description == normalized_description,
            EquipmentTemplate.is_active.is_(True),
        )
    ).first()
    if template is not None:
        return template

    alias = db.scalars(
        select(EquipmentAlias).where(EquipmentAlias.normalized_alias == normalized_description)
    ).first()
    if alias is not None:
        return db.get(EquipmentTemplate, alias.equipment_template_id)
    return None
