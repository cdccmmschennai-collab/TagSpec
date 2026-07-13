"""Shared normalization helpers used across import, matching and formatting."""

from __future__ import annotations


def normalize_equipment_description(value: str) -> str:
    """Uppercase, trim and collapse internal whitespace."""
    return " ".join(str(value or "").upper().strip().split())


def normalize_header(value: object) -> str:
    """Normalize an Excel header cell for tolerant matching."""
    return " ".join(str(value or "").upper().strip().split())


def normalize_tag_number(value: object) -> str:
    """Normalize a tag number for duplicate detection and matching."""
    return " ".join(str(value or "").upper().strip().split())
