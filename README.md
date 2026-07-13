# TagSpec — Equipment Attribute Workspace

Internal multi-user web application for entering equipment-specific attributes
tag-by-tag and exporting those values back into an uploaded Excel workbook.

> **TagSpec** is the product name. Backend package names, API routes, database
> tables and migrations retain their original identifiers for compatibility.

- **Frontend:** React 19 + TypeScript + Vite + React Router + TanStack Query + Axios + React Hook Form + Zod
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2 + Alembic + Pydantic Settings + psycopg + openpyxl
- **Database:** PostgreSQL 16 (the single live source of truth — Excel is **not** the collaboration database)

The structured attribute JSON stored in PostgreSQL is authoritative; the generated
`Additional Information` string (e.g. `BODY:A105N,SEAT:F316L+PEEK,...`) is only an
export representation produced on the backend.

---

## 1. Repository layout

```
equipment-additional-info/
├── frontend/            React + Vite app
├── backend/             FastAPI app, Alembic migrations, tests
│   ├── app/
│   │   ├── core/        config, db, security, errors, normalization
│   │   ├── models/      SQLAlchemy 2 models
│   │   ├── schemas/     Pydantic schemas
│   │   ├── services/    business logic (equipment, workbook, import, tag, export, formatter)
│   │   ├── api/v1/       routers
│   │   └── main.py
│   ├── alembic/         migration environment + versions
│   ├── scripts/         create_admin.py (first-admin seed)
│   └── tests/           pytest suite (+ workbook factory)
├── storage/uploads/     uploaded originals (git-ignored, NEVER modified)
├── storage/exports/     generated workbooks (git-ignored)
├── local-data/          place SAMPLE.xlsx here (git-ignored)
├── docs/                architecture & rules
├── docker-compose.yml   local PostgreSQL (host port 5544)
├── .env.example
└── .gitignore
```

---

## 2. Initial setup

### 2.1 Environment files

```bash
cp .env.example .env                       # root (backend reads this)
cp frontend/.env.example frontend/.env.local
```

Generate a real secret for anything beyond local dev:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"   # -> SECRET_KEY
```

### 2.2 Start PostgreSQL (dedicated container on port 5544)

> The compose file uses host port **5544** on purpose, so it never collides with
> any other Postgres already running on the machine (e.g. an existing CMMS on 5433).

```bash
docker compose up -d database
docker compose ps
```

### 2.3 Backend dependencies

```bash
cd backend
python3.12 -m venv .venv           # if .venv does not already exist
source .venv/bin/activate
python -m ensurepip --upgrade
pip install -e ".[dev]"            # or: pip install -e . for runtime only
```

### 2.4 Run migrations

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

### 2.5 Create the first admin (+ optional Ball Valve seed)

The password is read from `ADMIN_PASSWORD` (or prompted); it is never stored in source.

```bash
cd backend
source .venv/bin/activate
ADMIN_PASSWORD='ChangeMe@123' python -m scripts.create_admin \
    --employee-code ADM001 --full-name "First Admin" --seed-ball-valve
```

### 2.6 Start the backend

```bash
cd backend
source .venv/bin/activate
fastapi dev app/main.py            # or: uvicorn app.main:app --reload
```

### 2.7 Start the frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 3. URLs

| What            | URL |
|-----------------|-----|
| Frontend        | http://localhost:5173 |
| Backend API     | http://localhost:8000 |
| API docs        | http://localhost:8000/docs |
| Health          | http://localhost:8000/health and http://localhost:8000/api/v1/health |

---

## 4. Testing

```bash
# Backend (spins up a *_test database on the same Postgres automatically)
cd backend && source .venv/bin/activate
pytest                              # full suite (includes concurrency + workbook preservation)
pytest tests/test_export.py         # workbook regression tests only
pytest tests/test_concurrency.py    # simultaneous-claim test only
ruff check app tests scripts        # lint

# Frontend
cd frontend
npx tsc -b                          # TypeScript type check
npm run build                       # production build (tsc + vite)
```

Override the test DB connection with `TEST_DATABASE_URL` if needed.

---

## 5. Everyday development

```bash
docker compose up -d database       # start db
# backend:  cd backend && source .venv/bin/activate && fastapi dev app/main.py
# frontend: cd frontend && npm run dev
docker compose stop                 # stop db (keeps data)
docker compose logs -f database     # inspect db logs
```

Reset the local development database (DESTRUCTIVE — local only):

```bash
docker compose down -v              # drops the eai_pgdata volume
docker compose up -d database
cd backend && source .venv/bin/activate && alembic upgrade head
```

---

## 6. Database migrations

```bash
cd backend && source .venv/bin/activate
alembic revision --autogenerate -m "describe change"   # create
alembic upgrade head                                    # apply
alembic history                                         # inspect history
alembic downgrade -1                                    # rollback one (local only)
alembic check                                           # models vs migration drift
```

---

## 7. End-to-end manual test flow

1. Sign in at http://localhost:5173 with `ADM001`.
2. **Attribute Master → Create Equipment** `BALL VALVE` (or use `--seed-ball-valve`). Open it and
   add attributes `BODY, SEAT, STEM, BALL, OPERATING PRESSURE, OPERATING TEMPERATURE,
   STANDARD, FLANGE STANDARD`; reorder with ↑/↓ and reload to confirm order persists.
3. **Jobs → Upload** `local-data/SAMPLE.xlsx` (headers `TAG NUMBER REV-1`,
   `EQUIPMENT DESCRIPTION`, `ADDITIONAL INFORMATION` are auto-detected).
4. Open the job → **Import / Re-scan rows**. Review import statistics.
5. Select the equipment description → pick an **AVAILABLE** tag → it is claimed
   automatically and the attribute form (from the master) opens.
6. Enter values, watch the live preview, click **Complete and Next**
   (or Ctrl/Cmd+Enter). The tag disappears from the available list.
7. To test **multi-user locking**: open a second browser/incognito signed in as a
   different editor. A tag claimed by the first user is not selectable by the second,
   and a simultaneous claim returns `TAG_ALREADY_CLAIMED`.
8. **Generate Excel** (supervisor/admin). Download it from the export list. It is
   saved under `storage/exports/` as e.g. `P389_REV1_additional_info_YYYY-MM-DD_HHMMSS.xlsx`.
9. Verify the original under `storage/uploads/` is byte-for-byte unchanged
   (`shasum` before/after) and that only the `ADDITIONAL INFORMATION` cells changed
   in the export.

---

## 8. Git safety

Never commit: `.env` files, `*.xlsx/*.xlsm/*.xls`, `storage/uploads/*`,
`storage/exports/*`, `local-data/*`, `backend/.venv`, `frontend/node_modules`,
`frontend/dist`.

```bash
git ls-files | grep -E '\.(xlsx|xlsm|xls)$'      # must be empty
git ls-files | grep -E '(^|/)\.env($|\.)'         # must be empty (except .env.example)
```

---

## 9. Documentation

See `docs/` for: system architecture, database model, Excel import rules, the tag
status lifecycle, tag-locking logic, export rules, attribute-master administration,
and known limitations.

## 10. Known limitations

- Initial release supports **`.xlsx` only**.
- openpyxl preserves cell values, formulas, hyperlinks, merged ranges, freeze panes,
  row/column dimensions and data validations, but **cannot guarantee** preservation of
  macros (`.xlsm`), ActiveX controls, embedded shapes/objects, charts, or images. These
  are out of scope. See `docs/known-limitations.md`.
