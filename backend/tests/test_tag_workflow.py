"""Tag claiming, saving, completion and concurrency-adjacent tests (Phases 5-7)."""

from __future__ import annotations

from tests.helpers import create_equipment, import_rows, upload_workbook


def _setup_single_tag(client, auth):
    create_equipment(client, auth["admin"], "BALL VALVE", attrs=("BODY", "SEAT"))
    job = upload_workbook(client, auth["supervisor"], rows=[("P-1", "BALL VALVE", "")])
    import_rows(client, auth["supervisor"], job["id"])
    tags = client.get(
        f"/api/v1/workbooks/{job['id']}/tags",
        headers=auth["editor"],
        params={"equipment": "BALL VALVE"},
    ).json()
    return job, tags[0]


def test_claim_then_attributes_returned(client, auth):
    _job, tag = _setup_single_tag(client, auth)
    resp = client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["tag"]["status"] == "CLAIMED"
    assert [a["attribute_name"] for a in body["attributes"]] == ["BODY", "SEAT"]


def test_second_editor_cannot_claim(client, auth):
    _job, tag = _setup_single_tag(client, auth)
    assert client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"]).status_code == 200
    conflict = client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor2"])
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "TAG_ALREADY_CLAIMED"


def test_claimed_tag_hidden_from_other_editor(client, auth):
    job, tag = _setup_single_tag(client, auth)
    client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"])
    other = client.get(
        f"/api/v1/workbooks/{job['id']}/tags",
        headers=auth["editor2"],
        params={"equipment": "BALL VALVE"},
    ).json()
    assert other == []


def test_heartbeat_extends_only_owner(client, auth):
    _job, tag = _setup_single_tag(client, auth)
    claim = client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"]).json()
    hb = client.post(f"/api/v1/workbooks/tags/{tag['id']}/heartbeat", headers=auth["editor"])
    assert hb.status_code == 200
    assert hb.json()["claim_expires_at"] >= claim["tag"]["claim_expires_at"]
    not_owner = client.post(f"/api/v1/workbooks/tags/{tag['id']}/heartbeat", headers=auth["editor2"])
    assert not_owner.status_code == 403
    assert not_owner.json()["error"]["code"] == "TAG_NOT_OWNED"


def test_draft_then_complete(client, auth):
    _job, tag = _setup_single_tag(client, auth)
    claim = client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"]).json()
    v = claim["tag"]["row_version"]
    draft = client.post(
        f"/api/v1/workbooks/tags/{tag['id']}/draft",
        headers=auth["editor"],
        json={"values": {"BODY": "A105N"}, "row_version": v},
    )
    assert draft.status_code == 200
    assert draft.json()["status"] == "DRAFT"
    v2 = draft.json()["row_version"]
    complete = client.post(
        f"/api/v1/workbooks/tags/{tag['id']}/complete",
        headers=auth["editor"],
        json={"values": {"BODY": "A105N", "SEAT": "F316L"}, "row_version": v2},
    )
    assert complete.status_code == 200
    assert complete.json()["status"] == "COMPLETED"
    assert complete.json()["generated_additional_information"] == "BODY:A105N,SEAT:F316L"


def test_complete_requires_all_required(client, auth):
    _job, tag = _setup_single_tag(client, auth)
    claim = client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"]).json()
    resp = client.post(
        f"/api/v1/workbooks/tags/{tag['id']}/complete",
        headers=auth["editor"],
        json={"values": {"BODY": "A105N"}, "row_version": claim["tag"]["row_version"]},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "REQUIRED_ATTRIBUTE_MISSING"


def test_stale_version_rejected(client, auth):
    _job, tag = _setup_single_tag(client, auth)
    client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"])
    resp = client.post(
        f"/api/v1/workbooks/tags/{tag['id']}/draft",
        headers=auth["editor"],
        json={"values": {"BODY": "x"}, "row_version": 999},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "STALE_TAG_VERSION"


def test_completed_tag_disappears_from_available(client, auth):
    job, tag = _setup_single_tag(client, auth)
    claim = client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"]).json()
    client.post(
        f"/api/v1/workbooks/tags/{tag['id']}/complete",
        headers=auth["editor"],
        json={"values": {"BODY": "A", "SEAT": "B"}, "row_version": claim["tag"]["row_version"]},
    )
    avail = client.get(
        f"/api/v1/workbooks/{job['id']}/tags",
        headers=auth["editor"],
        params={"equipment": "BALL VALVE"},
    ).json()
    assert avail == []


def test_supervisor_force_release(client, auth):
    _job, tag = _setup_single_tag(client, auth)
    client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"])
    resp = client.post(f"/api/v1/workbooks/tags/{tag['id']}/force-release", headers=auth["supervisor"])
    assert resp.status_code == 200
    assert resp.json()["status"] == "AVAILABLE"
    # editor2 can now claim
    assert client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor2"]).status_code == 200


def test_release_preserves_draft_values(client, auth):
    _job, tag = _setup_single_tag(client, auth)
    claim = client.post(f"/api/v1/workbooks/tags/{tag['id']}/claim", headers=auth["editor"]).json()
    client.post(
        f"/api/v1/workbooks/tags/{tag['id']}/draft",
        headers=auth["editor"],
        json={"values": {"BODY": "A105N"}, "row_version": claim["tag"]["row_version"]},
    )
    released = client.post(f"/api/v1/workbooks/tags/{tag['id']}/release", headers=auth["editor"])
    assert released.status_code == 200
    assert released.json()["status"] == "AVAILABLE"
    assert released.json()["attribute_values_json"] == {"BODY": "A105N"}
