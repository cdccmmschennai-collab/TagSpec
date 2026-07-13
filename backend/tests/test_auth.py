"""Authentication and authorization tests (Phase 8)."""

from __future__ import annotations


def test_login_and_me(client, auth):
    me = client.get("/api/v1/auth/me", headers=auth["editor"])
    assert me.status_code == 200
    assert me.json()["employee_code"] == "EDT1"
    assert me.json()["role"] == "EDITOR"


def test_bad_credentials_rejected(client, users):
    resp = client.post("/api/v1/auth/login", json={"employee_code": "EDT1", "password": "wrong"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_unauthenticated_rejected(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_admin_can_manage_users(client, auth):
    resp = client.post(
        "/api/v1/users",
        headers=auth["admin"],
        json={"employee_code": "NEW1", "full_name": "New Person", "password": "password1", "role": "EDITOR"},
    )
    assert resp.status_code == 201
    assert client.get("/api/v1/users", headers=auth["admin"]).status_code == 200


def test_editor_cannot_manage_users(client, auth):
    resp = client.get("/api/v1/users", headers=auth["editor"])
    assert resp.status_code == 403


def test_refresh_token(client, users):
    login = client.post("/api/v1/auth/login", json={"employee_code": "EDT1", "password": "password1"}).json()
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert resp.status_code == 200
    assert "access_token" in resp.json()
