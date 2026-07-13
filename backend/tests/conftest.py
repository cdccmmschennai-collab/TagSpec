"""Pytest fixtures. Runs against a dedicated *_test PostgreSQL database.

The test DB connection defaults to the local docker-compose Postgres (port 5544)
and can be overridden with TEST_DATABASE_URL.
"""

from __future__ import annotations

import os

# Point the whole application at the test database BEFORE importing app modules.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://eai_app:change_me_local_only@localhost:5544/equipment_addl_info_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

import app.models  # noqa: E402,F401  (register tables)
from app.core.database import Base, engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
from app.schemas.auth import UserCreate  # noqa: E402
from app.services import auth_service  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402


def _admin_url() -> str:
    # Swap the target db for the maintenance 'postgres' database.
    base, _, _db = TEST_DATABASE_URL.rpartition("/")
    return f"{base}/postgres"


def _test_db_name() -> str:
    return TEST_DATABASE_URL.rpartition("/")[2]


@pytest.fixture(scope="session", autouse=True)
def _prepare_database():
    admin = create_engine(_admin_url(), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"),
            {"n": _test_db_name()},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{_test_db_name()}"'))
    admin.dispose()

    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    with engine.begin() as conn:
        tables = ", ".join(f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables))
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(fastapi_app)


# --- auth helpers ---


def _make_user(db, code: str, role: str) -> None:
    auth_service.create_user(
        db,
        UserCreate(employee_code=code, full_name=f"{role} {code}", password="password1", role=role),
    )


@pytest.fixture
def users(db):
    _make_user(db, "ADM1", "ADMIN")
    _make_user(db, "SUP1", "SUPERVISOR")
    _make_user(db, "EDT1", "EDITOR")
    _make_user(db, "EDT2", "EDITOR")
    return {"admin": "ADM1", "supervisor": "SUP1", "editor": "EDT1", "editor2": "EDT2"}


def _login(client, code: str, password: str = "password1") -> str:
    resp = client.post("/api/v1/auth/login", json={"employee_code": code, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture
def auth(client, users):
    """Return a dict of role -> Authorization headers."""
    return {
        role: {"Authorization": f"Bearer {_login(client, code)}"}
        for role, code in users.items()
    }
