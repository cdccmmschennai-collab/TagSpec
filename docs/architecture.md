# Architecture

## Overview

```
React SPA (Vite)  ──HTTP/JSON──►  FastAPI (app/api/v1)  ──►  Services  ──►  SQLAlchemy 2  ──►  PostgreSQL 16
                                        │
                                        └──► openpyxl (read uploads / write exports on the server only)
```

- **PostgreSQL is the single live source of truth** for all multi-user state
  (jobs, tag rows, claims, structured values, history). Excel is never used as the
  shared collaboration database.
- The uploaded workbook is stored once under `storage/uploads/` and **never modified**.
  Exports are fresh copies written to `storage/exports/`.

## Backend module boundaries

| Layer | Location | Responsibility |
|-------|----------|----------------|
| core | `app/core` | settings, engine/session, security (bcrypt + JWT), error types/handlers, normalization |
| models | `app/models` | SQLAlchemy 2 tables + string enums |
| schemas | `app/schemas` | Pydantic request/response contracts |
| services | `app/services` | business logic — `equipment_service`, `workbook_service`, `import_service`, `tag_service`, `export_service`, `formatter`, `auth_service`, `seed` |
| api | `app/api/v1` | thin routers; auth/role guards in `app/api/deps.py` |

The **formatter** (`app/services/formatter.py`) is the single source of truth for the
generated `Additional Information` string. It is decoupled from the ORM via a small
`AttributeSpec` dataclass and is used by both draft (best-effort) and complete (strict)
paths. The frontend has an independent preview but the backend value is authoritative.

## Authorization

- `ADMIN` — manage users and the equipment/attribute master.
- `SUPERVISOR` (+ ADMIN) — upload/import/export workbooks, review, force-release.
- `EDITOR` (+ above) — claim tags and enter values.

Guards are enforced on the server (`require_admin`, `require_supervisor`,
`get_current_user`), never only by hiding frontend buttons.
