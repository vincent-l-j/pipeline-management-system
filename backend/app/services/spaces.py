"""DigitalOcean Spaces adapter for the attachment document store.

The only module in the app that names a bucket or an S3 operation. Nothing above
it knows object storage exists: it is constructed in `app/core/documents.py` and
injected as a `DocumentStore`.

Two credentials pass through here, and neither leaves: the secret access key,
which only ever reaches `SigV4Auth`, and the signature derived from it, which
rides in a header. This adapter never presigns a URL — `download_attachment`
proxies bytes through the backend deliberately, because the backend is the only
security boundary this system has, and handing the browser a presigned link would
move the decision about who may read a file to the bucket's own permissions. That
is a decision needing its own review, not an optimisation to reach for later.

Everything this module puts in an error goes through `_safe`, and the log stream
is covered at the handler — see "Logging" in docs/best-practices/backend-fastapi.md.
"""

from collections.abc import Iterator
from pathlib import PurePosixPath
from typing import BinaryIO
from urllib.parse import quote
from uuid import uuid4
from xml.etree import ElementTree

import httpx

from app.core.redaction import redact_credentials, reduce_url_to_path
from app.services.document_store import (
    DocumentStore,
    DocumentStoreError,
    StoredItem,
    leaf_name,
)
from app.services.sigv4 import Credentials, SigV4Auth

# This module deliberately has no logger, for the reason the Graph adapter has
# none: it reports failures to its caller and lets the route decide what is safe
# to record.

# S3 refuses a part below 5 MiB unless it is the last one, so the ceiling has to
# sit above that. 8 MiB also bounds what one upload holds in memory, which is the
# point — the instance this runs on has 512 MB.
MINIMUM_PART_SIZE = 5 * 1024 * 1024
SINGLE_REQUEST_CEILING = 8 * 1024 * 1024
UPLOAD_PART_SIZE = 8 * 1024 * 1024

DOWNLOAD_CHUNK_SIZE = 64 * 1024

# `store_item_id` on the attachment record is a VARCHAR(255), and the key is what
# goes in it. SQLite ignores the width and Postgres does not, so a key built past
# this would pass every test and then fail in production *after* the object was
# written — orphaning it. Bounded here rather than trusted to be short.
MAX_ITEM_ID_BYTES = 255

# Uploading a deck over a domestic connection outlasts httpx's 5-second default.
SPACES_TIMEOUT = httpx.Timeout(30.0, read=300.0)


def spaces_document_store(
    *,
    endpoint_url: str,
    region: str,
    bucket: str,
    root_prefix: str,
    access_key_id: str,
    secret_access_key: str,
) -> "SpacesDocumentStore":
    """Build the adapter with its own signing HTTP client.

    Here rather than at the wiring edge so that httpx and the credentials are
    named in this module and nowhere else — which is the property the adapter
    exists to give.
    """
    return SpacesDocumentStore(
        bucket=bucket,
        root_prefix=root_prefix,
        http=httpx.Client(
            base_url=endpoint_url,
            timeout=SPACES_TIMEOUT,
            # Signing at the client, not per call, so a request added here later
            # cannot be sent unsigned.
            auth=SigV4Auth(
                Credentials(
                    access_key_id=access_key_id,
                    secret_access_key=secret_access_key,
                    region=region,
                )
            ),
        ),
    )


def _safe(text: str) -> str:
    """The one funnel every message this module builds passes through.

    A presigned URL carries its credential in the query string, so the query goes
    first and what survives is then redacted — a message added here later inherits
    the rule instead of quietly reopening the hole.
    """
    return redact_credentials(reduce_url_to_path(text))


def _element(body: bytes, tag: str) -> str | None:
    """The text of the first element with this local name, namespace ignored.

    Parsed with the standard library rather than a hardened parser because the
    only XML reaching this is the store's own response over TLS, and just two
    small elements are ever read out of it.
    """
    try:
        root = ElementTree.fromstring(body)
    except ElementTree.ParseError:
        return None
    for element in root.iter():
        if element.tag.rpartition("}")[2] == tag:
            return (element.text or "").strip() or None
    return None


def _folded(leaf: str) -> str:
    """The file name reduced to characters that survive a URL unchanged.

    The name a user sees comes off the attachment record, not off the key, so
    nothing is lost here but legibility in a bucket listing. What is bought is
    that the key is encoded identically in the request line and in the signature —
    a space or a non-ASCII character that the two disagree about is a
    `SignatureDoesNotMatch` with nothing in it saying which end was wrong.
    """
    return "".join(
        character if character.isascii() and (character.isalnum() or character in "._-") else "-"
        for character in leaf
    )


def _within(leaf: str, budget: int) -> str:
    """The name truncated to fit the record's column, extension kept.

    The extension earns its place over the stem: it is what a browser and an
    operator both read first.
    """
    if len(leaf) <= budget:
        return leaf
    suffix = PurePosixPath(leaf).suffix
    if len(suffix) >= budget:
        return leaf[:budget]
    return leaf[: len(leaf) - len(suffix)][: budget - len(suffix)] + suffix


class SpacesDocumentStore(DocumentStore):
    """Keeps pitch attachments as objects in a DigitalOcean Space."""

    def __init__(
        self,
        *,
        bucket: str,
        root_prefix: str,
        http: httpx.Client,
        single_request_ceiling: int = SINGLE_REQUEST_CEILING,
    ) -> None:
        self._bucket = bucket
        self._root_prefix = root_prefix
        self._http = http
        self._single_request_ceiling = single_request_ceiling

    # --- addressing ---------------------------------------------------------

    def _object_key(self, folder: str, filename: str) -> str:
        """Where a file goes, and the identifier it will be remembered by.

        A fresh uuid per upload, which is the whole answer to keys being chosen by
        the caller rather than assigned by the store. Two uploads of `deck.pdf` to
        one pitch become two distinct objects, so deleting one cannot take the
        other's bytes, and there is no replace-on-collision behaviour to emulate —
        that only existed in the Graph adapter because Graph forced a choice.
        """
        head = "/".join(part for part in (self._root_prefix, folder, str(uuid4())) if part)
        budget = MAX_ITEM_ID_BYTES - len(head) - 1
        if budget < 1:
            raise DocumentStoreError("The document store left no room for a file name")
        return f"{head}/{_within(_folded(leaf_name(filename)), budget)}"

    def _ready(self) -> None:
        """Refuse before building a request the client cannot even address.

        The `SPACES_*` settings default to empty so a missing one degrades
        attachments rather than stopping the app booting — which makes an
        unconfigured store something a deployed environment actually reaches. It
        has to arrive at the route as a store failure: an endpoint built from an
        empty region has an empty DNS label, and encoding that host raises
        something the route does not catch, so the caller would get a 500 with a
        traceback instead of the 502 that says what to do about it.
        """
        host = self._http.base_url.host
        if not self._bucket or not host or "" in host.split("."):
            raise DocumentStoreError("The document store is not configured")

    def _checked_key(self, item_id: str) -> str:
        """The key, or a refusal.

        These arrive from our own records rather than from a caller, so this is
        defence in depth — the same standing as `leaf_name`'s own refusal. A key
        that escapes the prefix is the shape a path traversal would take if one of
        those records were ever writable.
        """
        if not item_id or ".." in item_id or "//" in item_id:
            raise DocumentStoreError("The document store was given no usable item")
        if self._root_prefix and not item_id.startswith(f"{self._root_prefix}/"):
            raise DocumentStoreError("The document store was given an item outside its prefix")
        return item_id

    def _object_url(self, key: str) -> str:
        """Path-style, so one base URL serves every bucket and one name resolves."""
        return f"/{quote(self._bucket, safe='')}/{quote(key, safe='/')}"

    # --- upload -------------------------------------------------------------

    def upload(
        self,
        *,
        folder: str,
        filename: str,
        content: BinaryIO,
        size_bytes: int,
        content_type: str,
    ) -> StoredItem:
        self._ready()
        key = self._object_key(folder, filename)
        if size_bytes > self._single_request_ceiling:
            return self._upload_in_parts(key, content, size_bytes)
        return self._upload_in_one_request(key, content, size_bytes, content_type)

    def _upload_in_one_request(
        self, key: str, content: BinaryIO, size_bytes: int, content_type: str
    ) -> StoredItem:
        body = content.read()
        if len(body) != size_bytes:
            raise DocumentStoreError(
                f"The document store received {len(body)} of {size_bytes} bytes"
            )
        self._call(
            "PUT", self._object_url(key), content=body, headers={"Content-Type": content_type}
        )
        return StoredItem(item_id=key, size_bytes=len(body))

    def _upload_in_parts(self, key: str, content: BinaryIO, size_bytes: int) -> StoredItem:
        url = self._object_url(key)
        opened = self._call("POST", url, params={"uploads": ""})
        upload_id = _element(opened.content, "UploadId")
        if not upload_id:
            raise DocumentStoreError("The document store opened no upload session")

        try:
            sent, etags = self._send_parts(url, upload_id, content, size_bytes)
            if sent != size_bytes:
                # A short read means the object the store would assemble is not the
                # file we were given. Failing is the honest answer; a truncated
                # upload reporting success is the shape of bug this whole feature
                # avoids.
                raise DocumentStoreError(
                    f"The document store received {sent} of {size_bytes} bytes"
                )
            self._complete(url, upload_id, etags)
        except DocumentStoreError:
            # Parts already accepted are stored and billed until the upload is
            # abandoned, and unlike a Graph session nothing expires them.
            self._abandon(url, upload_id)
            raise
        return StoredItem(item_id=key, size_bytes=size_bytes)

    def _send_parts(
        self, url: str, upload_id: str, content: BinaryIO, size_bytes: int
    ) -> tuple[int, list[str]]:
        sent = 0
        etags: list[str] = []
        while sent < size_bytes:
            chunk = content.read(UPLOAD_PART_SIZE)
            if not chunk:
                break
            response = self._call(
                "PUT",
                url,
                params={"partNumber": str(len(etags) + 1), "uploadId": upload_id},
                content=chunk,
            )
            etag = response.headers.get("etag")
            if not etag:
                raise DocumentStoreError("The document store named no part it had stored")
            etags.append(etag)
            sent += len(chunk)
        return sent, etags

    def _complete(self, url: str, upload_id: str, etags: list[str]) -> None:
        parts = "".join(
            f"<Part><PartNumber>{number}</PartNumber><ETag>{etag}</ETag></Part>"
            for number, etag in enumerate(etags, start=1)
        )
        response = self._call(
            "POST",
            url,
            params={"uploadId": upload_id},
            content=f"<CompleteMultipartUpload>{parts}</CompleteMultipartUpload>".encode(),
            headers={"Content-Type": "application/xml"},
        )
        # S3 answers this one with a 200 whose body says it failed: the status is
        # committed before the assembly is done, so `is_error` is False for a
        # failure. Reading the body is the only way to tell, and skipping it would
        # record an attachment pointing at an object that was never assembled.
        if _element(response.content, "Code"):
            raise DocumentStoreError("The document store could not assemble the upload")

    def _abandon(self, url: str, upload_id: str) -> None:
        """Best effort, and deliberately silent.

        An abort that also fails must not replace the failure that caused it —
        the caller needs to hear why the upload did not happen, not why the
        cleanup after it did not either.
        """
        try:
            self._call("DELETE", url, params={"uploadId": upload_id})
        except DocumentStoreError:
            pass

    # --- download -----------------------------------------------------------

    def download(self, item_id: str) -> Iterator[bytes]:
        self._ready()
        url = self._object_url(self._checked_key(item_id))
        try:
            # The context manager spans the yields, so the body is still being
            # read off the socket as the caller consumes it — the point of
            # returning an iterator at all.
            with self._http.stream("GET", url) as response:
                self._refuse_if_unusable(response)
                yield from response.iter_bytes(DOWNLOAD_CHUNK_SIZE)
        except httpx.HTTPError as exc:
            raise DocumentStoreError(
                f"The document store could not be read: {_safe(str(exc))}"
            ) from exc

    def _refuse_if_unusable(self, response: httpx.Response) -> None:
        if response.is_redirect or response.is_error:
            response.read()
            raise DocumentStoreError(
                f"The document store refused the download ({response.status_code})"
            )

    # --- delete -------------------------------------------------------------

    def delete(self, item_id: str) -> None:
        """Remove the object.

        The store answers 204 whether or not the key was there, and that is the
        answer this wants: the caller's question is "is the file gone", and for a
        key the store does not hold it is. Refusing a second delete would trap the
        record of a file someone had already removed out of band, with no way to
        clear it.
        """
        self._ready()
        self._call("DELETE", self._object_url(self._checked_key(item_id)))

    # --- transport ----------------------------------------------------------

    def _call(self, method: str, url: str, **kwargs) -> httpx.Response:
        try:
            response = self._http.request(method, url, **kwargs)
        except httpx.HTTPError as exc:
            raise DocumentStoreError(
                f"The document store could not be reached: {_safe(str(exc))}"
            ) from exc
        if response.is_redirect:
            # Not followed: a redirect here means the region is wrong, and httpx
            # would re-send an Authorization signed for the old host and turn that
            # into a signature error that says nothing about the real cause.
            raise DocumentStoreError(
                f"The document store redirected {method} {_safe(url)} ({response.status_code})"
            )
        if response.is_error:
            # The status and the path, never the body: a refused signature comes
            # back with the string that was signed and the key id that signed it.
            raise DocumentStoreError(
                f"The document store refused {method} {_safe(url)} ({response.status_code})"
            )
        return response
