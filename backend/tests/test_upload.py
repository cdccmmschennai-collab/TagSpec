"""Workbook upload tests (Phase 3)."""

from __future__ import annotations

from tests.workbook_factory import build_basic_workbook


def _upload(client, headers, content: bytes, filename="book.xlsx", **form):
    return client.post(
        "/api/v1/workbooks",
        headers=headers,
        files={"file": (filename, content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data=form,
    )


def test_valid_upload_detects_headers(client, auth):
    content = build_basic_workbook(
        lead_columns=3,
        header_row=4,
        rows=[("P-1", "BALL VALVE", "")],
    )
    resp = _upload(client, auth["supervisor"], content, project_code="P389", revision="REV1")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["duplicate"] is False
    v = body["validation"]
    assert v["sheet_name"] == "TAGS"
    assert v["header_row_number"] == 4
    assert v["tag_column_number"] == 4  # 3 lead cols + 1


def test_missing_headers_rejected(client, auth):
    content = build_basic_workbook(headers=("A", "B", "C"), rows=[("x", "y", "z")])
    resp = _upload(client, auth["supervisor"], content)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "MISSING_REQUIRED_COLUMNS"


def test_unsupported_extension_rejected(client, auth):
    content = build_basic_workbook(rows=[("P-1", "BALL VALVE", "")])
    resp = _upload(client, auth["supervisor"], content, filename="book.xls")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "UNSUPPORTED_EXTENSION"


def test_invalid_workbook_signature_rejected(client, auth):
    resp = _upload(client, auth["supervisor"], b"not a real xlsx file")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_WORKBOOK_SIGNATURE"


def test_duplicate_hash_returns_existing_job(client, auth):
    content = build_basic_workbook(rows=[("P-1", "BALL VALVE", "")])
    first = _upload(client, auth["supervisor"], content)
    assert first.status_code == 201
    first_id = first.json()["job"]["id"]
    second = _upload(client, auth["supervisor"], content)
    assert second.status_code == 201
    assert second.json()["duplicate"] is True
    assert second.json()["job"]["id"] == first_id


def test_editor_cannot_upload(client, auth):
    content = build_basic_workbook(rows=[("P-1", "BALL VALVE", "")])
    resp = _upload(client, auth["editor"], content)
    assert resp.status_code == 403
