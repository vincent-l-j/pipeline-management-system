"""Pitch attachments — the record pointing at a file in the document store."""

from uuid import UUID

import pytest
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from app.models.attachment import PitchAttachment
from app.models.user import User, UserRole
from app.schemas import attachment as attachment_schemas
from app.schemas.attachment import AttachmentOut
from tests.constants import UNKNOWN_ID


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


# --- Schemas are allowlists -------------------------------------------------


def _attachment_schemas() -> dict[str, type[BaseModel]]:
    return {
        name: value
        for name, value in vars(attachment_schemas).items()
        if isinstance(value, type) and issubclass(value, BaseModel) and value is not BaseModel
    }


def test_the_response_exposes_exactly_the_fields_needed_to_render_a_row():
    assert set(AttachmentOut.model_fields) == {
        "id",
        "pitch_id",
        "filename",
        "content_type",
        "size_bytes",
        "uploaded_by_name",
        "created_at",
    }


def test_no_schema_carries_the_stores_item_identifier():
    """The store's address for the item is how a caller would route around the
    download endpoint, which is the only thing enforcing read access.

    Over every schema in the module rather than the one that exists today, so a
    schema added tomorrow inherits the rule instead of quietly reopening the hole.
    """
    carrying = [
        name
        for name, schema in _attachment_schemas().items()
        if "store_item_id" in schema.model_fields
    ]
    assert carrying == []


def test_there_is_no_request_schema_for_the_client_to_widen():
    """The client chooses nothing about where a file goes: the folder is the
    pitch's id and the uploader is the authenticated caller. A request body with
    a path, folder, site or uploader field is not a field to leave out — it is a
    schema that should not exist.
    """
    settable = [name for name in _attachment_schemas() if name.endswith(("Create", "Update"))]
    assert settable == []


def test_the_response_names_the_uploader(admin_client, db_session):
    pitch_id = _new_pitch(admin_client, "Uploader Name Pitch")
    uploader = User(
        email="named@rozettainstitute.com",
        display_name="Named Uploader",
        role=UserRole.ASSESSOR,
    )
    db_session.add(uploader)
    db_session.flush()
    db_session.add(_attachment(pitch_id, uploaded_by_id=uploader.id))
    db_session.commit()

    stored = db_session.query(PitchAttachment).filter_by(pitch_id=pitch_id).one()
    assert AttachmentOut.model_validate(stored).uploaded_by_name == "Named Uploader"


def test_the_response_tolerates_an_attachment_with_no_uploader(admin_client, db_session):
    pitch_id = _new_pitch(admin_client, "Unattributed Upload Pitch")
    db_session.add(_attachment(pitch_id, uploaded_by_id=None))
    db_session.commit()

    stored = db_session.query(PitchAttachment).filter_by(pitch_id=pitch_id).one()
    assert AttachmentOut.model_validate(stored).uploaded_by_name is None


# --- Listing a pitch's attachments ------------------------------------------


@pytest.mark.parametrize("role", ["admin", "assessor", "viewer"])
def test_anyone_who_can_read_the_pitch_can_list_its_attachments(request, role, admin_client):
    """Viewers included: seeing that a document exists is not being able to
    change it, and a read-only user who cannot see the attachments cannot do
    their job."""
    pitch_id = _new_pitch(admin_client, f"Listable Pitch For {role}")
    client = request.getfixturevalue(f"{role}_client")

    assert client.get(f"/api/pitches/{pitch_id}/attachments").status_code == 200


def test_listing_attachments_needs_authentication(client):
    assert client.get(f"/api/pitches/{UNKNOWN_ID}/attachments").status_code == 403


def test_listing_the_attachments_of_a_pitch_that_does_not_exist_is_not_found(admin_client):
    assert admin_client.get(f"/api/pitches/{UNKNOWN_ID}/attachments").status_code == 404


def test_the_list_holds_only_that_pitchs_attachments(admin_client, db_session):
    wanted = _new_pitch(admin_client, "Listed Pitch")
    other = _new_pitch(admin_client, "Unlisted Pitch")
    db_session.add_all(
        [
            _attachment(wanted, filename="wanted.pdf"),
            _attachment(other, filename="other.pdf"),
        ]
    )
    db_session.commit()

    listed = admin_client.get(f"/api/pitches/{wanted}/attachments").json()
    assert [row["filename"] for row in listed] == ["wanted.pdf"]


def test_the_list_reports_each_attachment_as_the_display_schema(admin_client, db_session):
    pitch_id = _new_pitch(admin_client, "Shape Of A Listed Row Pitch")
    db_session.add(
        _attachment(pitch_id, filename="deck.pdf", content_type="application/pdf", size_bytes=2048)
    )
    db_session.commit()

    (row,) = admin_client.get(f"/api/pitches/{pitch_id}/attachments").json()
    assert set(row) == {
        "id",
        "pitch_id",
        "filename",
        "content_type",
        "size_bytes",
        "uploaded_by_name",
        "created_at",
    }
    assert (row["filename"], row["content_type"], row["size_bytes"]) == (
        "deck.pdf",
        "application/pdf",
        2048,
    )


def test_the_list_never_names_the_stores_item_identifier(admin_client, db_session):
    pitch_id = _new_pitch(admin_client, "No Store Id Pitch")
    db_session.add(_attachment(pitch_id, store_item_id="01SECRETADDRESS"))
    db_session.commit()

    response = admin_client.get(f"/api/pitches/{pitch_id}/attachments")
    assert "01SECRETADDRESS" not in response.text


def test_a_pitch_with_no_attachments_lists_nothing(admin_client):
    pitch_id = _new_pitch(admin_client, "Empty Attachment List Pitch")

    assert admin_client.get(f"/api/pitches/{pitch_id}/attachments").json() == []
