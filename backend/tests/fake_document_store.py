"""An in-memory document store for the tests.

Stands in for the real tenant everywhere the attachment surface is exercised, so
every path — including the failure paths — is reachable without credentials. It
implements the whole `DocumentStore` interface, which `abc` enforces at
construction: a method added to the interface and not to this class makes every
test that builds one fail immediately.

It also records what it was asked to do, so a test can assert the store was never
reached at all — the shape of "an unacceptable file is refused before it is sent".
"""

from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import BinaryIO

from app.services.document_store import DocumentStore, DocumentStoreError, StoredItem

# Small, so a test can force chunking with a handful of bytes.
FAKE_CHUNK_SIZE = 8


@dataclass
class FakeStoredFile:
    folder: str
    filename: str
    content: bytes
    content_type: str


@dataclass
class FakeDocumentStore(DocumentStore):
    files: dict[str, FakeStoredFile] = field(default_factory=dict)
    uploads: list[tuple[str, str]] = field(default_factory=list)
    downloads: list[str] = field(default_factory=list)
    deletes: list[str] = field(default_factory=list)
    # Forced failures, one flag per operation: a delete that fails while uploads
    # keep working is a real state the endpoints have to answer for.
    fail_upload: bool = False
    fail_download: bool = False
    fail_delete: bool = False
    _next_id: int = 0

    @property
    def calls(self) -> int:
        """Every operation attempted, so a test can assert on none at all."""
        return len(self.uploads) + len(self.downloads) + len(self.deletes)

    def upload(
        self,
        *,
        folder: str,
        filename: str,
        content: BinaryIO,
        size_bytes: int,
        content_type: str,
    ) -> StoredItem:
        self.uploads.append((folder, filename))
        if self.fail_upload:
            raise DocumentStoreError("The document store refused the upload")
        body = content.read()
        self._next_id += 1
        item_id = f"fake-item-{self._next_id}"
        self.files[item_id] = FakeStoredFile(folder, filename, body, content_type)
        return StoredItem(item_id=item_id, size_bytes=len(body))

    def download(self, item_id: str) -> Iterator[bytes]:
        self.downloads.append(item_id)
        if self.fail_download:
            raise DocumentStoreError("The document store could not read the file")
        stored = self.files.get(item_id)
        if stored is None:
            raise DocumentStoreError("The document store has no such item")
        for start in range(0, len(stored.content), FAKE_CHUNK_SIZE):
            yield stored.content[start : start + FAKE_CHUNK_SIZE]

    def delete(self, item_id: str) -> None:
        self.deletes.append(item_id)
        if self.fail_delete:
            raise DocumentStoreError("The document store could not delete the file")
        self.files.pop(item_id, None)
