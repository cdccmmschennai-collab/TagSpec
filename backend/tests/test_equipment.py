"""Equipment master tests (Phase 2)."""

from __future__ import annotations


def _create_ball_valve(client, headers):
    return client.post(
        "/api/v1/equipment",
        headers=headers,
        json={
            "equipment_description": "Ball Valve",
            "equipment_code": "BV",
            "attributes": [
                {"attribute_name": "BODY", "display_order": 1},
                {"attribute_name": "SEAT", "display_order": 2},
                {"attribute_name": "STEM", "display_order": 3},
            ],
        },
    )


def test_create_equipment_and_ordered_attributes(client, auth):
    resp = _create_ball_valve(client, auth["admin"])
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["normalized_description"] == "BALL VALVE"
    names = [a["attribute_name"] for a in body["attributes"]]
    assert names == ["BODY", "SEAT", "STEM"]


def test_duplicate_normalized_description_prevented(client, auth):
    assert _create_ball_valve(client, auth["admin"]).status_code == 201
    dup = client.post(
        "/api/v1/equipment",
        headers=auth["admin"],
        json={"equipment_description": "  ball   valve ", "attributes": []},
    )
    assert dup.status_code == 409
    assert dup.json()["error"]["code"] == "DUPLICATE_EQUIPMENT_DESCRIPTION"


def test_alias_creation_and_conflict(client, auth):
    eq_id = _create_ball_valve(client, auth["admin"]).json()["id"]
    ok = client.post(
        f"/api/v1/equipment/{eq_id}/aliases",
        headers=auth["admin"],
        json={"alias": "BV Ball Valve"},
    )
    assert ok.status_code == 201
    # alias duplicating the equipment description must fail
    conflict = client.post(
        f"/api/v1/equipment/{eq_id}/aliases",
        headers=auth["admin"],
        json={"alias": "ball valve"},
    )
    assert conflict.status_code == 409


def test_reorder_attributes_persists(client, auth):
    body = _create_ball_valve(client, auth["admin"]).json()
    eq_id = body["id"]
    attrs = {a["attribute_name"]: a["id"] for a in body["attributes"]}
    resp = client.post(
        f"/api/v1/equipment/{eq_id}/attributes/reorder",
        headers=auth["admin"],
        json={
            "items": [
                {"id": attrs["STEM"], "display_order": 1},
                {"id": attrs["BODY"], "display_order": 2},
                {"id": attrs["SEAT"], "display_order": 3},
            ]
        },
    )
    assert resp.status_code == 200
    reloaded = client.get(f"/api/v1/equipment/{eq_id}/attributes", headers=auth["admin"]).json()
    assert [a["attribute_name"] for a in reloaded] == ["STEM", "BODY", "SEAT"]


def test_required_flag_and_add_attribute(client, auth):
    eq_id = _create_ball_valve(client, auth["admin"]).json()["id"]
    resp = client.post(
        f"/api/v1/equipment/{eq_id}/attributes",
        headers=auth["admin"],
        json={"attribute_name": "note", "is_required": False, "display_order": 2},
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["attribute_name"] == "NOTE"
    assert created["is_required"] is False


def test_editor_cannot_create_equipment(client, auth):
    resp = _create_ball_valve(client, auth["editor"])
    assert resp.status_code == 403
