"""Pitch attachments — the record pointing at a file in the document store."""

from uuid import UUID

import pytest
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from app.api.routes.attachments import MAX_ATTACHMENT_BYTES
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
            store_item_id="pitches/8f2b1c04-9a3e-4d77-8b21-5c6e0f1a2d33/3c9d5e71-4a2b-4f18-9c60-7d8e1b0a4f52/business-case.docx",
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
        "pitches/8f2b1c04-9a3e-4d77-8b21-5c6e0f1a2d33/3c9d5e71-4a2b-4f18-9c60-7d8e1b0a4f52/business-case.docx",
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


# --- Uploading a file -------------------------------------------------------


def _upload(client, pitch_id, *, name="deck.pdf", body=b"a pitch deck", content_type=None):
    return client.post(
        f"/api/pitches/{pitch_id}/attachments",
        files={"file": (name, body, content_type or "application/pdf")},
    )


def test_an_acceptable_file_is_stored_and_recorded(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Uploadable Pitch")

    response = _upload(admin_client, pitch_id)

    assert response.status_code == 201
    assert response.json()["filename"] == "deck.pdf"
    assert len(document_store.files) == 1


def test_the_stored_file_is_byte_identical_to_what_was_uploaded(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Byte Identical Pitch")
    body = bytes(range(256)) * 64

    _upload(admin_client, pitch_id, body=body)

    (stored,) = document_store.files.values()
    assert stored.content == body


def test_an_uploaded_file_appears_in_the_pitchs_list(admin_client):
    pitch_id = _new_pitch(admin_client, "Upload Then List Pitch")

    _upload(admin_client, pitch_id, name="business-case.docx")

    listed = admin_client.get(f"/api/pitches/{pitch_id}/attachments").json()
    assert [row["filename"] for row in listed] == ["business-case.docx"]


def test_the_record_names_the_caller_as_the_uploader(admin_client, db_session):
    pitch_id = _new_pitch(admin_client, "Attributed Upload Pitch")

    _upload(admin_client, pitch_id)

    stored = db_session.query(PitchAttachment).filter_by(pitch_id=pitch_id).one()
    assert stored.uploaded_by_id == admin_client.user.id


def test_the_recorded_size_is_the_size_of_the_file(admin_client, db_session):
    pitch_id = _new_pitch(admin_client, "Recorded Size Pitch")

    _upload(admin_client, pitch_id, body=b"x" * 1234)

    stored = db_session.query(PitchAttachment).filter_by(pitch_id=pitch_id).one()
    assert stored.size_bytes == 1234


def test_the_recorded_content_type_comes_from_the_name_not_the_caller(admin_client, db_session):
    """A caller's declared type is a claim about a file we already hold; the
    extension is what the library and the browser will act on."""
    pitch_id = _new_pitch(admin_client, "Declared Type Pitch")

    _upload(admin_client, pitch_id, name="deck.pdf", content_type="text/html")

    stored = db_session.query(PitchAttachment).filter_by(pitch_id=pitch_id).one()
    assert stored.content_type == "application/pdf"


# --- The folder is the pitch's id, not its title ----------------------------


def test_the_file_lands_in_a_folder_named_by_the_pitchs_identifier(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Folder Keying Pitch")

    _upload(admin_client, pitch_id)

    assert document_store.uploads == [(str(pitch_id), "deck.pdf")]


def test_renaming_a_pitch_does_not_move_where_its_files_go(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Original Title Pitch")
    _upload(admin_client, pitch_id, name="before.pdf")

    admin_client.patch(f"/api/pitches/{pitch_id}", json={"title": "Renamed Entirely"})
    _upload(admin_client, pitch_id, name="after.pdf")

    assert {folder for folder, _ in document_store.uploads} == {str(pitch_id)}


# --- Unacceptable files are refused before the store is called --------------


def test_an_oversized_file_is_refused(admin_client):
    pitch_id = _new_pitch(admin_client, "Oversized Upload Pitch")

    response = _upload(admin_client, pitch_id, body=b"x" * (MAX_ATTACHMENT_BYTES + 1))

    assert response.status_code == 400


def test_the_refusal_of_an_oversized_file_names_the_limit(admin_client):
    pitch_id = _new_pitch(admin_client, "Oversized Message Pitch")

    response = _upload(admin_client, pitch_id, body=b"x" * (MAX_ATTACHMENT_BYTES + 1))

    assert str(MAX_ATTACHMENT_BYTES // (1024 * 1024)) in response.json()["detail"]


def test_an_oversized_file_never_reaches_the_store(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Oversized Untouched Store Pitch")

    _upload(admin_client, pitch_id, body=b"x" * (MAX_ATTACHMENT_BYTES + 1))

    assert document_store.calls == 0


def test_a_file_exactly_on_the_limit_is_accepted(admin_client):
    pitch_id = _new_pitch(admin_client, "Exactly On The Limit Pitch")

    response = _upload(admin_client, pitch_id, body=b"x" * MAX_ATTACHMENT_BYTES)

    assert response.status_code == 201


@pytest.mark.parametrize("name", ["payload.exe", "script.sh", "archive.zip", "noextension"])
def test_a_disallowed_type_is_refused(admin_client, name):
    pitch_id = _new_pitch(admin_client, f"Disallowed {name} Pitch")

    response = _upload(admin_client, pitch_id, name=name)

    assert response.status_code == 400


def test_the_refusal_of_a_disallowed_type_names_what_is_allowed(admin_client):
    pitch_id = _new_pitch(admin_client, "Disallowed Message Pitch")

    response = _upload(admin_client, pitch_id, name="payload.exe")

    assert ".pdf" in response.json()["detail"]


def test_a_disallowed_type_never_reaches_the_store(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Disallowed Untouched Store Pitch")

    _upload(admin_client, pitch_id, name="payload.exe")

    assert document_store.calls == 0


def test_a_request_carrying_no_file_at_all_is_rejected(admin_client):
    """A part with no filename is a form field, not a file, so this never reaches
    the route: `File(...)` is unsatisfied and the automatic 422 answers it."""
    pitch_id = _new_pitch(admin_client, "Nameless Upload Pitch")

    response = _upload(admin_client, pitch_id, name="")

    assert response.status_code == 422


@pytest.mark.parametrize("name", [".", "..", "/", "decks/"])
def test_a_name_that_reduces_to_no_file_is_refused(admin_client, name):
    pitch_id = _new_pitch(admin_client, f"Unusable Name {name} Pitch")

    response = _upload(admin_client, pitch_id, name=name)

    assert response.status_code == 400


def test_a_refused_file_adds_no_row(admin_client):
    pitch_id = _new_pitch(admin_client, "Refused Adds Nothing Pitch")

    _upload(admin_client, pitch_id, name="payload.exe")

    assert admin_client.get(f"/api/pitches/{pitch_id}/attachments").json() == []


# --- A failed store leaves nothing behind -----------------------------------


def test_a_store_failure_is_reported_to_the_caller(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Failing Store Pitch")
    document_store.fail_upload = True

    assert _upload(admin_client, pitch_id).status_code == 502


def test_a_store_failure_creates_no_record(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Failing Store No Record Pitch")
    document_store.fail_upload = True

    _upload(admin_client, pitch_id)

    assert admin_client.get(f"/api/pitches/{pitch_id}/attachments").json() == []


def test_a_store_failure_quotes_nothing_the_store_said(admin_client, document_store):
    """The detail is fixed text. The store's own message goes to the log with the
    request id instead — the caller quotes the id, the log holds the detail, and
    nothing derived from a credential crosses the wire."""
    pitch_id = _new_pitch(admin_client, "Opaque Store Failure Pitch")
    document_store.fail_upload = True

    detail = _upload(admin_client, pitch_id).json()["detail"]

    assert "refused the upload" not in detail


# --- Editing rights, enforced by the server ---------------------------------


def test_an_assessor_can_upload(assessor_client, admin_client):
    pitch_id = _new_pitch(admin_client, "Assessor Upload Pitch")

    assert _upload(assessor_client, pitch_id).status_code == 201


def test_uploading_to_a_pitch_that_does_not_exist_is_not_found(admin_client):
    assert _upload(admin_client, UNKNOWN_ID).status_code == 404


def test_unauthenticated_upload_is_rejected(client):
    assert _upload(client, UNKNOWN_ID).status_code == 403


# --- Deleting an attachment -------------------------------------------------


def _first_attachment(client, pitch_id) -> str:
    return client.get(f"/api/pitches/{pitch_id}/attachments").json()[0]["id"]


def test_an_editors_delete_removes_the_record(admin_client):
    pitch_id = _new_pitch(admin_client, "Deletable Attachment Pitch")
    attachment_id = _upload(admin_client, pitch_id).json()["id"]

    assert (
        admin_client.delete(f"/api/pitches/{pitch_id}/attachments/{attachment_id}").status_code
        == 200
    )
    assert admin_client.get(f"/api/pitches/{pitch_id}/attachments").json() == []


def test_an_editors_delete_removes_the_stored_file(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Deletable Stored File Pitch")
    attachment_id = _upload(admin_client, pitch_id).json()["id"]

    admin_client.delete(f"/api/pitches/{pitch_id}/attachments/{attachment_id}")

    assert document_store.files == {}


def test_deleting_one_attachment_leaves_the_others_on_the_pitch(admin_client):
    pitch_id = _new_pitch(admin_client, "Several Attachments Pitch")
    doomed = _upload(admin_client, pitch_id, name="doomed.pdf").json()["id"]
    _upload(admin_client, pitch_id, name="kept.pdf")

    admin_client.delete(f"/api/pitches/{pitch_id}/attachments/{doomed}")

    listed = admin_client.get(f"/api/pitches/{pitch_id}/attachments").json()
    assert [row["filename"] for row in listed] == ["kept.pdf"]


def test_deleting_one_attachment_leaves_the_others_stored(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Several Stored Files Pitch")
    doomed = _upload(admin_client, pitch_id, name="doomed.pdf").json()["id"]
    _upload(admin_client, pitch_id, name="kept.pdf")

    admin_client.delete(f"/api/pitches/{pitch_id}/attachments/{doomed}")

    assert [stored.filename for stored in document_store.files.values()] == ["kept.pdf"]


def test_deleting_an_attachment_that_does_not_exist_is_not_found(admin_client):
    pitch_id = _new_pitch(admin_client, "Missing Attachment Pitch")

    assert (
        admin_client.delete(f"/api/pitches/{pitch_id}/attachments/{UNKNOWN_ID}").status_code == 404
    )


# --- A failed store deletion keeps the record -------------------------------


def test_a_failed_store_deletion_reports_the_failure(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Failing Delete Pitch")
    attachment_id = _upload(admin_client, pitch_id).json()["id"]
    document_store.fail_delete = True

    assert (
        admin_client.delete(f"/api/pitches/{pitch_id}/attachments/{attachment_id}").status_code
        == 502
    )


def test_a_failed_store_deletion_leaves_the_record_in_place(admin_client, document_store):
    """A row whose file is gone can be found and cleaned up; a file with no row
    is invisible. So the row goes last, and only if the store agreed."""
    pitch_id = _new_pitch(admin_client, "Failing Delete Keeps Row Pitch")
    attachment_id = _upload(admin_client, pitch_id).json()["id"]
    document_store.fail_delete = True

    admin_client.delete(f"/api/pitches/{pitch_id}/attachments/{attachment_id}")

    listed = admin_client.get(f"/api/pitches/{pitch_id}/attachments").json()
    assert [row["id"] for row in listed] == [attachment_id]


# --- The server refuses a read-only user, whatever the interface shows -------

_ATTACHMENT_OPERATIONS = {
    "list": lambda client, pitch_id, attachment_id: client.get(
        f"/api/pitches/{pitch_id}/attachments"
    ),
    "upload": lambda client, pitch_id, attachment_id: _upload(client, pitch_id, name="new.pdf"),
    "delete": lambda client, pitch_id, attachment_id: client.delete(
        f"/api/pitches/{pitch_id}/attachments/{attachment_id}"
    ),
}


@pytest.mark.parametrize(
    ("role", "operation", "expected"),
    [
        # Spelled out rather than ALLOWED/DENIED: a successful upload is 201, so
        # the column would have to mean two different codes to read as "may they?".
        ("viewer", "list", 200),
        ("viewer", "upload", 403),
        ("viewer", "delete", 403),
        ("assessor", "list", 200),
        ("assessor", "upload", 201),
        ("assessor", "delete", 200),
        ("admin", "list", 200),
        ("admin", "upload", 201),
        ("admin", "delete", 200),
    ],
)
def test_attachment_rbac(request, admin_client, role, operation, expected):
    pitch_id = _new_pitch(admin_client, f"RBAC {role} {operation} Pitch")
    attachment_id = _upload(admin_client, pitch_id).json()["id"]
    client = request.getfixturevalue(f"{role}_client")

    assert (
        _ATTACHMENT_OPERATIONS[operation](client, pitch_id, attachment_id).status_code == expected
    )


def test_a_viewers_refused_delete_leaves_the_file_stored(
    viewer_client, admin_client, document_store
):
    """The refusal is the server's, not a hidden button's — so the file is still
    there afterwards."""
    pitch_id = _new_pitch(admin_client, "Viewer Refused Delete Pitch")
    attachment_id = _upload(admin_client, pitch_id).json()["id"]

    viewer_client.delete(f"/api/pitches/{pitch_id}/attachments/{attachment_id}")

    assert len(document_store.files) == 1


def test_a_viewers_refused_upload_reaches_no_store(viewer_client, admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Viewer Refused Upload Pitch")

    _upload(viewer_client, pitch_id)

    assert document_store.calls == 0


def test_unauthenticated_delete_is_rejected(client):
    assert client.delete(f"/api/pitches/{UNKNOWN_ID}/attachments/{UNKNOWN_ID}").status_code == 403


def test_deleting_an_attachment_named_under_another_pitch_is_not_found(admin_client):
    owner = _new_pitch(admin_client, "Owning Pitch For Delete")
    other = _new_pitch(admin_client, "Unrelated Pitch For Delete")
    attachment_id = _upload(admin_client, owner).json()["id"]

    assert (
        admin_client.delete(f"/api/pitches/{other}/attachments/{attachment_id}").status_code == 404
    )


# --- Downloading through the backend ----------------------------------------


def _download(client, pitch_id, attachment_id):
    return client.get(f"/api/pitches/{pitch_id}/attachments/{attachment_id}/download")


def test_a_download_returns_the_bytes_that_were_uploaded(admin_client):
    pitch_id = _new_pitch(admin_client, "Downloadable Pitch")
    body = bytes(range(256)) * 8
    attachment_id = _upload(admin_client, pitch_id, body=body).json()["id"]

    response = _download(admin_client, pitch_id, attachment_id)

    assert response.status_code == 200
    assert response.content == body


def test_a_download_is_served_with_the_recorded_content_type(admin_client):
    pitch_id = _new_pitch(admin_client, "Download Content Type Pitch")
    attachment_id = _upload(admin_client, pitch_id, name="notes.txt").json()["id"]

    response = _download(admin_client, pitch_id, attachment_id)

    assert response.headers["content-type"].startswith("text/plain")


def test_a_download_is_served_with_the_recorded_filename(admin_client):
    pitch_id = _new_pitch(admin_client, "Download Filename Pitch")
    attachment_id = _upload(admin_client, pitch_id, name="business-case.docx").json()["id"]

    response = _download(admin_client, pitch_id, attachment_id)

    assert 'filename="business-case.docx"' in response.headers["content-disposition"]


def test_a_download_hands_out_no_link_to_the_document_library(admin_client):
    """A redirect would move "who may read this" from this application to the
    library's own permissions, and would put a signed URL in browser history."""
    pitch_id = _new_pitch(admin_client, "No Redirect Pitch")
    attachment_id = _upload(admin_client, pitch_id).json()["id"]

    response = _download(admin_client, pitch_id, attachment_id)

    assert response.status_code == 200
    assert "location" not in response.headers


def test_a_download_streams_rather_than_buffering_the_whole_file(admin_client):
    """No Content-Length: the body is produced by an iterator, so the bytes go out
    as they arrive. Replacing that with a buffered read would set the header and
    fail here — which is the point, on an instance with 512 MB."""
    pitch_id = _new_pitch(admin_client, "Streamed Download Pitch")
    attachment_id = _upload(admin_client, pitch_id, body=b"x" * 4096).json()["id"]

    response = _download(admin_client, pitch_id, attachment_id)

    assert "content-length" not in response.headers


@pytest.mark.parametrize("role", ["admin", "assessor", "viewer"])
def test_anyone_who_can_read_the_pitch_can_download_its_attachments(request, role, admin_client):
    pitch_id = _new_pitch(admin_client, f"Downloadable Pitch For {role}")
    attachment_id = _upload(admin_client, pitch_id).json()["id"]
    client = request.getfixturevalue(f"{role}_client")

    assert _download(client, pitch_id, attachment_id).status_code == 200


def test_unauthenticated_download_is_rejected(client):
    assert _download(client, UNKNOWN_ID, UNKNOWN_ID).status_code == 403


def test_downloading_an_attachment_that_does_not_exist_is_not_found(admin_client):
    pitch_id = _new_pitch(admin_client, "Missing Download Pitch")

    assert _download(admin_client, pitch_id, UNKNOWN_ID).status_code == 404


def test_a_store_failure_on_download_is_reported(admin_client, document_store):
    pitch_id = _new_pitch(admin_client, "Failing Download Pitch")
    attachment_id = _upload(admin_client, pitch_id).json()["id"]
    document_store.fail_download = True

    assert _download(admin_client, pitch_id, attachment_id).status_code == 502


# --- An identifier is not an authorisation ----------------------------------


def test_downloading_an_attachment_named_under_another_pitch_is_not_found(admin_client):
    """The caller may edit the pitch they named — that is the point. The
    attachment still belongs to a different one."""
    owner = _new_pitch(admin_client, "Owning Pitch For Download")
    editable = _new_pitch(admin_client, "Editable Wrong Pitch For Download")
    attachment_id = _upload(admin_client, owner).json()["id"]

    assert _download(admin_client, editable, attachment_id).status_code == 404


def test_a_refused_cross_pitch_delete_leaves_the_file_stored(admin_client, document_store):
    owner = _new_pitch(admin_client, "Owning Pitch Keeps Its File")
    editable = _new_pitch(admin_client, "Editable Wrong Pitch Keeps Nothing")
    attachment_id = _upload(admin_client, owner).json()["id"]

    admin_client.delete(f"/api/pitches/{editable}/attachments/{attachment_id}")

    assert len(document_store.files) == 1


def test_a_refused_cross_pitch_delete_leaves_the_record(admin_client):
    owner = _new_pitch(admin_client, "Owning Pitch Keeps Its Row")
    editable = _new_pitch(admin_client, "Editable Wrong Pitch Removes Nothing")
    attachment_id = _upload(admin_client, owner).json()["id"]

    admin_client.delete(f"/api/pitches/{editable}/attachments/{attachment_id}")

    listed = admin_client.get(f"/api/pitches/{owner}/attachments").json()
    assert [row["id"] for row in listed] == [attachment_id]


def test_a_cross_pitch_download_reads_nothing_from_the_store(admin_client, document_store):
    owner = _new_pitch(admin_client, "Owning Pitch Unread")
    editable = _new_pitch(admin_client, "Editable Wrong Pitch Unread")
    attachment_id = _upload(admin_client, owner).json()["id"]

    _download(admin_client, editable, attachment_id)

    assert document_store.downloads == []
