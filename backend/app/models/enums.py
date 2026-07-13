"""String enum values used across the domain (stored as plain strings)."""

from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    SUPERVISOR = "SUPERVISOR"
    EDITOR = "EDITOR"


class JobStatus(StrEnum):
    UPLOADED = "UPLOADED"
    VALIDATING = "VALIDATING"
    READY = "READY"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    EXPORTING = "EXPORTING"
    EXPORTED = "EXPORTED"
    FAILED = "FAILED"


class TagStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    TEMPLATE_MISSING = "TEMPLATE_MISSING"
    EXISTING_IN_EXCEL = "EXISTING_IN_EXCEL"
    CLAIMED = "CLAIMED"
    DRAFT = "DRAFT"
    COMPLETED = "COMPLETED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    REVIEWED = "REVIEWED"
    EXPORTED = "EXPORTED"


class HistoryAction(StrEnum):
    CLAIMED = "CLAIMED"
    DRAFT_SAVED = "DRAFT_SAVED"
    COMPLETED = "COMPLETED"
    EDITED = "EDITED"
    RELEASED = "RELEASED"
    FORCE_RELEASED = "FORCE_RELEASED"
    REVIEWED = "REVIEWED"
    EXPORTED = "EXPORTED"


class ExportStatus(StrEnum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
