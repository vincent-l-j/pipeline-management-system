"""Pitch attachments — the record pointing at a file in the document store."""

from uuid import UUID

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.attachment import PitchAttachment
from app.models.user import User, UserRole


def _attachment(pitch_id: UUID | None, **overrides) -> PitchAttachment:
    fields = {
        "pitch_id": pitch_id,
        "store_item_id": "01STOREITEM",
        "filename": "deck.pdf",
        "content_type": "application/pdf",
        "size_bytes": 2048,
        "uploaded_by_id": None,
    }
    return PitchAttachment(**{**fields, **overrides})


def _new_pitch(client, title: str) -> UUID:
    return UUID(client.post("/api/pitches", json={"title": title}).json()["id"])


def test_attachment_cannot_exist_without_a_pitch(db_session):
    db_session.add(_attachment(None))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_attachment_records_the_store_pointer_and_its_uploader(admin_client, db_session):
    pitch_id = _new_pitch(admin_client, "Attachment Field Pitch")
    uploader = User(
        email="uploader@rozettainstitute.com",
        display_name="Uploader",
        role=UserRole.ASSESSOR,
    )
    db_session.add(uploader)
    db_session.flush()

    db_session.add(
        _attachment(
            pitch_id,
            store_item_id="01DRIVEITEMID",
            filename="business-case.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size_bytes=51_200,
            uploaded_by_id=uploader.id,
        )
    )
    db_session.commit()

    stored = db_session.query(PitchAttachment).filter_by(pitch_id=pitch_id).one()
    assert (
        stored.store_item_id,
        stored.filename,
        stored.content_type,
        stored.size_bytes,
        stored.uploaded_by_id,
    ) == (
        "01DRIVEITEMID",
        "business-case.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        51_200,
        uploader.id,
    )
    assert stored.created_at is not None


def test_deleting_a_pitch_removes_its_attachment_rows(admin_client, db_session):
    pitch_id = _new_pitch(admin_client, "Doomed Attachment Pitch")
    db_session.add(_attachment(pitch_id))
    db_session.commit()

    assert admin_client.delete(f"/api/pitches/{pitch_id}").status_code == 200

    db_session.expire_all()
    assert db_session.query(PitchAttachment).filter_by(pitch_id=pitch_id).count() == 0


def test_deleting_a_pitch_leaves_another_pitchs_attachments(admin_client, db_session):
    doomed = _new_pitch(admin_client, "Deleted Neighbour Pitch")
    survivor = _new_pitch(admin_client, "Surviving Neighbour Pitch")
    db_session.add_all([_attachment(doomed), _attachment(survivor)])
    db_session.commit()

    assert admin_client.delete(f"/api/pitches/{doomed}").status_code == 200

    db_session.expire_all()
    assert db_session.query(PitchAttachment).filter_by(pitch_id=survivor).count() == 1
