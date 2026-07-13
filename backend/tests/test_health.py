"""Health endpoint tests (Phase 1)."""

from __future__ import annotations


def test_root_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_api_health(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_db_health(client):
    resp = client.get("/api/v1/health/db")
    assert resp.status_code == 200
    assert resp.json()["database"] == "reachable"


def test_settings_loaded():
    from app.core.config import settings

    assert settings.claim_expiry_minutes == 30
    assert "test" in settings.sqlalchemy_url  # conftest points at the *_test db
