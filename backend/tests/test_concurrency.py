"""Concurrency test: many simultaneous claims, exactly one winner (Phase 6)."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.errors import AppError
from app.models.tag_row import ImportedTagRow
from app.models.user import ApplicationUser
from app.services import tag_service
from tests.helpers import create_equipment, import_rows, upload_workbook


def test_simultaneous_claims_single_winner(client, auth, db):
    create_equipment(client, auth["admin"], "BALL VALVE")
    job = upload_workbook(client, auth["supervisor"], rows=[("P-1", "BALL VALVE", "")])
    import_rows(client, auth["supervisor"], job["id"])

    tag = db.scalars(
        select(ImportedTagRow).where(ImportedTagRow.workbook_job_id == uuid.UUID(job["id"]))
    ).first()
    tag_id = tag.id

    user_ids = [u.id for u in db.scalars(select(ApplicationUser)).all()]
    assert len(user_ids) >= 3

    def attempt(user_id):
        session = SessionLocal()
        try:
            tag_service.claim_tag(session, tag_id, user_id)
            return "won"
        except AppError:
            return "lost"
        finally:
            session.close()

    # 10 concurrent attempts spread across the available users.
    attempts = [user_ids[i % len(user_ids)] for i in range(10)]
    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(attempt, attempts))

    assert results.count("won") == 1, results

    db.expire_all()
    final = db.get(ImportedTagRow, tag_id)
    assert final.status == "CLAIMED"
    assert final.claimed_by is not None
