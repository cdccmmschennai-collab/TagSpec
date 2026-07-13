"""Centralized Additional Information formatter (single source of truth).

The generated string is only an *export representation*; the structured JSON
values remain the authoritative data. The frontend preview must never be
trusted as the saved value.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from app.core.errors import ValidationAppError


@dataclass(frozen=True)
class AttributeSpec:
    """Minimal attribute shape the formatter needs (decoupled from ORM)."""

    attribute_name: str
    display_order: int
    is_required: bool


def _clean(value: object) -> str:
    return " ".join(str(value or "").replace("\r", " ").replace("\n", " ").split())


def build_additional_information(
    attributes: Iterable[AttributeSpec],
    values: dict[str, str],
    *,
    require_all: bool = True,
) -> str:
    """Build the ``KEY:VALUE,KEY:VALUE`` string in master display_order.

    - Attribute order comes only from ``display_order``.
    - Key/value separated by a single colon; pairs by a single comma.
    - Empty optional attributes are skipped.
    - Commas are not allowed inside a value (comma is the pair separator).
    - When ``require_all`` is True, missing required values raise.
    """
    ordered = sorted(attributes, key=lambda a: a.display_order)
    parts: list[str] = []

    for attribute in ordered:
        key = attribute.attribute_name.strip().upper()
        value = _clean(values.get(key, ""))

        if attribute.is_required and not value:
            if require_all:
                raise ValidationAppError(
                    f"Required attribute '{key}' is missing a value",
                    code="REQUIRED_ATTRIBUTE_MISSING",
                )
            continue

        if not value:
            continue

        if "," in value:
            raise ValidationAppError(
                f"Attribute '{key}' value must not contain a comma "
                "(comma separates attribute pairs)",
                code="COMMA_IN_VALUE",
            )
        if ":" in key:
            raise ValidationAppError(
                f"Attribute name '{key}' must not contain a colon",
                code="COLON_IN_KEY",
            )

        parts.append(f"{key}:{value}")

    if not parts:
        raise ValidationAppError(
            "At least one attribute value is required",
            code="NO_ATTRIBUTE_VALUES",
        )

    return ",".join(parts)


def normalize_values(values: dict[str, str]) -> dict[str, str]:
    """Uppercase keys and whitespace-normalize values for storage."""
    result: dict[str, str] = {}
    for key, value in values.items():
        result[str(key).strip().upper()] = _clean(value)
    return result
