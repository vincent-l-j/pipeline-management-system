"""The document store interface and the in-memory fake standing in for it.

The adapter's own behaviour is covered in `test_spaces_document_store.py`, over a
real HTTP client. What is here is the contract both of them answer to: that the
fake really implements the interface, and that its failure switches behave the way
the endpoint tests rely on when they force a store to fail.
"""

import io

import pytest

from app.services.document_store import DocumentStore, DocumentStoreError, leaf_name
from tests.fake_document_store import FakeDocumentStore


def _upload(fake: FakeDocumentStore, body: bytes = b"the whole pitch deck"):
    return fake.upload(
        folder="p1",
        filename="deck.pdf",
        content=io.BytesIO(body),
        size_bytes=len(body),
        content_type="application/pdf",
    )


# --- The interface and the fake ---------------------------------------------


def test_the_fake_implements_every_method_the_interface_declares():
    assert FakeDocumentStore.__abstractmethods__ == frozenset()
    assert isinstance(FakeDocumentStore(), DocumentStore)


def test_the_fake_returns_the_bytes_it_was_given():
    fake = FakeDocumentStore()
    stored = _upload(fake)

    assert b"".join(fake.download(stored.item_id)) == b"the whole pitch deck"


def test_a_forced_upload_failure_raises_the_store_error():
    with pytest.raises(DocumentStoreError):
        _upload(FakeDocumentStore(fail_upload=True), b"x")


def test_a_forced_upload_failure_stores_nothing():
    fake = FakeDocumentStore(fail_upload=True)
    with pytest.raises(DocumentStoreError):
        _upload(fake, b"x")

    assert fake.files == {}


def test_a_forced_delete_failure_leaves_the_file_in_place():
    fake = FakeDocumentStore()
    stored = _upload(fake, b"keep me")
    fake.fail_delete = True

    with pytest.raises(DocumentStoreError):
        fake.delete(stored.item_id)

    assert b"".join(fake.download(stored.item_id)) == b"keep me"


# --- The name rule every adapter builds its address from --------------------


@pytest.mark.parametrize(
    ("sent", "kept"),
    [
        ("deck.pdf", "deck.pdf"),
        ("../../secrets.pdf", "secrets.pdf"),
        ("/etc/secrets.pdf", "secrets.pdf"),
        ("C:\\decks\\secrets.pdf", "secrets.pdf"),
        ("sub/dir/secrets.pdf", "secrets.pdf"),
    ],
)
def test_a_path_a_caller_sent_is_stripped_from_the_name(sent, kept):
    """Shared rather than per-adapter: every store builds an address out of this
    name, so each of them has the same hole if it skips the strip."""
    assert leaf_name(sent) == kept


@pytest.mark.parametrize("sent", ["", ".", "..", "/"])
def test_a_name_that_names_no_file_is_refused(sent):
    with pytest.raises(DocumentStoreError):
        leaf_name(sent)
