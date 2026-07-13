"""Tag import tests (Phase 4)."""

from __future__ import annotations

from tests.helpers import create_equipment, import_rows, upload_workbook


def test_import_statuses_and_stats(client, auth):
    create_equipment(client, auth["admin"], "BALL VALVE")
    job = upload_workbook(
        client,
        auth["supervisor"],
        rows=[
            ("P-1", "BALL VALVE", ""),          # AVAILABLE (matched, blank)
            ("P-2", "GATE VALVE", ""),          # TEMPLATE_MISSING (unmatched, blank)
            ("P-3", "BALL VALVE", "EXISTING:X"),  # EXISTING_IN_EXCEL
            ("", "BALL VALVE", ""),             # blank tag -> ignored
            ("P-5", "", ""),                    # blank equipment -> ignored
        ],
    )
    stats = import_rows(client, auth["supervisor"], job["id"])
    assert stats["total_tag_rows"] == 3
    assert stats["available_tags"] == 1
    assert stats["template_missing_tags"] == 1
    assert stats["existing_in_excel_tags"] == 1
    assert stats["matched_equipment_count"] == 2  # P-1 and P-3 match BALL VALVE
    assert stats["unmatched_equipment_count"] == 1


def test_alias_matching(client, auth):
    eq = create_equipment(client, auth["admin"], "BALL VALVE")
    client.post(
        f"/api/v1/equipment/{eq['id']}/aliases",
        headers=auth["admin"],
        json={"alias": "BV"},
    )
    job = upload_workbook(client, auth["supervisor"], rows=[("P-1", "bv", "")])
    stats = import_rows(client, auth["supervisor"], job["id"])
    assert stats["available_tags"] == 1
    assert stats["matched_equipment_count"] == 1


def test_duplicate_tag_numbers_reported(client, auth):
    create_equipment(client, auth["admin"], "BALL VALVE")
    job = upload_workbook(
        client,
        auth["supervisor"],
        rows=[("P-1", "BALL VALVE", ""), ("p-1 ", "BALL VALVE", "")],
    )
    stats = import_rows(client, auth["supervisor"], job["id"])
    assert "P-1" in stats["duplicate_tag_numbers"]
    assert stats["total_tag_rows"] == 2  # both rows preserved, not lost


def test_existing_in_excel_hidden_from_editor_dropdown(client, auth):
    create_equipment(client, auth["admin"], "BALL VALVE")
    job = upload_workbook(
        client,
        auth["supervisor"],
        rows=[("P-1", "BALL VALVE", ""), ("P-2", "BALL VALVE", "EXISTING:X")],
    )
    import_rows(client, auth["supervisor"], job["id"])
    tags = client.get(
        f"/api/v1/workbooks/{job['id']}/tags",
        headers=auth["editor"],
        params={"equipment": "BALL VALVE"},
    ).json()
    tag_numbers = {t["tag_number"] for t in tags}
    assert tag_numbers == {"P-1"}  # EXISTING_IN_EXCEL P-2 excluded


def test_row_numbers_preserved(client, auth):
    create_equipment(client, auth["admin"], "BALL VALVE")
    # header row 1, so first data row is Excel row 2
    job = upload_workbook(client, auth["supervisor"], rows=[("P-1", "BALL VALVE", "")])
    import_rows(client, auth["supervisor"], job["id"])
    tags = client.get(
        f"/api/v1/workbooks/{job['id']}/tags", headers=auth["supervisor"]
    ).json()
    assert tags[0]["excel_row_number"] == 2


def test_metadata_reference_row_is_ignored(client, auth):
    """A SAP-style numeric column-reference row (tag=11, equipment=6, addl=31)
    sits between the header and real data. It must NOT be imported as a tag,
    while genuine tag rows still import.

    Regression for the SAMPLE.xlsx off-by-one: the workbook has 486 real tag
    rows but the importer reported 487 because Excel row 5 (the SAP field
    column-number band) has numeric values in the tag/equipment/addl columns
    and slipped past the "tag and equipment present" rule.
    """
    create_equipment(client, auth["admin"], "BALL VALVE")
    job = upload_workbook(
        client,
        auth["supervisor"],
        rows=[
            ("11", "6", "31"),  # SAP metadata column-reference row -> ignored
            ("22-4202-BV-0099", "BALL VALVE", ""),  # real -> AVAILABLE
            ("22-4202-BV-0036", "BALL VALVE", "EXISTING:X"),  # real -> EXISTING
        ],
    )
    stats = import_rows(client, auth["supervisor"], job["id"])
    assert stats["total_tag_rows"] == 2
    assert stats["available_tags"] == 1
    assert stats["existing_in_excel_tags"] == 1

    tags = client.get(
        f"/api/v1/workbooks/{job['id']}/tags", headers=auth["supervisor"]
    ).json()
    tag_numbers = {t["tag_number"] for t in tags}
    assert "11" not in tag_numbers
    assert tag_numbers == {"22-4202-BV-0099", "22-4202-BV-0036"}


def test_numeric_looking_equipment_still_imported(client, auth):
    """Equipment descriptions that merely contain digits (e.g. '3 WAY VALVE')
    must still import. Only *purely* numeric metadata values are rejected, so a
    legitimate company tag is never dropped."""
    create_equipment(client, auth["admin"], "3 WAY VALVE")
    job = upload_workbook(
        client,
        auth["supervisor"],
        rows=[("22-BV-01", "3 WAY VALVE", "")],
    )
    stats = import_rows(client, auth["supervisor"], job["id"])
    assert stats["total_tag_rows"] == 1
    assert stats["available_tags"] == 1


def test_assign_unmatched_then_available(client, auth):
    eq = create_equipment(client, auth["admin"], "BALL VALVE")
    job = upload_workbook(client, auth["supervisor"], rows=[("P-1", "GATE VALVE", "")])
    import_rows(client, auth["supervisor"], job["id"])
    assign = client.post(
        f"/api/v1/workbooks/{job['id']}/assign-equipment",
        headers=auth["supervisor"],
        json={
            "normalized_equipment_description": "GATE VALVE",
            "equipment_template_id": eq["id"],
        },
    )
    assert assign.status_code == 200
    assert assign.json()["updated_rows"] == 1
    tags = client.get(
        f"/api/v1/workbooks/{job['id']}/tags",
        headers=auth["editor"],
        params={"equipment": "GATE VALVE"},
    ).json()
    assert len(tags) == 1  # now AVAILABLE
