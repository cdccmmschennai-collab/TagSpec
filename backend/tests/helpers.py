"""Shared high-level helpers for API tests."""

from __future__ import annotations

from tests.workbook_factory import build_basic_workbook


def create_equipment(client, headers, description="BALL VALVE", attrs=("BODY", "SEAT")):
    resp = client.post(
        "/api/v1/equipment",
        headers=headers,
        json={
            "equipment_description": description,
            "attributes": [
                {"attribute_name": name, "display_order": i + 1, "is_required": True}
                for i, name in enumerate(attrs)
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def upload_workbook(client, headers, rows, **form):
    content = build_basic_workbook(rows=rows)
    resp = client.post(
        "/api/v1/workbooks",
        headers=headers,
        files={"file": ("book.xlsx", content, "application/octet-stream")},
        data=form,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["job"]


def import_rows(client, headers, job_id):
    resp = client.post(f"/api/v1/workbooks/{job_id}/import", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()
