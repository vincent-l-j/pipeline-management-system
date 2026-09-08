"""The Spaces adapter, over a real signing client against a stub transport.

Same shape and the same reason as `test_document_store.py`: the credential
assertions here exist to catch a leak that came from the HTTP client's own log
line, which a mocked-out client never emits. Signing runs for real too, so a
request the adapter builds badly fails here rather than against a live Space.

The cases that carry their weight are the ones with no Graph analogue — an error
inside a 200, parts that are billed until abandoned, and a delete that is
idempotent.
"""

import io

import httpx
import pytest

from app.services.document_store import DocumentStoreError, StoredItem
from app.services.sigv4 import Credentials, SigV4Auth
from app.services.spaces import (
    MAX_ITEM_ID_BYTES,
    MINIMUM_PART_SIZE,
    SINGLE_REQUEST_CEILING,
    UPLOAD_PART_SIZE,
    SpacesDocumentStore,
)

ENDPOINT = "https://syd1.digitaloceanspaces.com"
REGION = "syd1"
BUCKET = "rozetta-pms-test"
ROOT_PREFIX = "pitches"
FOLDER = "6f4727c0-0000-4000-8000-00000000beef"

# Shaped like the real things, so a test that lets one through fails on a value an
# operator would recognise as a working credential rather than on a short string.
ACCESS_KEY_ID = "DO00EXAMPLEACCESSKEYID"
SECRET_ACCESS_KEY = "Xy7+n0tAr3alSp4c3sS3cr3t/K3y0123456789abcdefgh"
PRESIGNED_SIGNATURE = "8ba0b2c1f4e6d7a9c3b5e8f1a2d4c6b8e0f2a4c6d8e0f2a4c6d8e0f2a4c6d8e0"
PRESIGNED_URL = (
    f"{ENDPOINT}/{BUCKET}/{ROOT_PREFIX}/deck.pdf"
    f"?X-Amz-Credential={ACCESS_KEY_ID}%2F20260904%2F{REGION}%2Fs3%2Faws4_request"
    f"&X-Amz-Signature={PRESIGNED_SIGNATURE}"
)

# What a refused signature actually comes back as. The store echoes the request it
# reconstructed, which is why the adapter never quotes a response body.
SIGNATURE_REFUSED = f"""<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>SignatureDoesNotMatch</Code>
<Message>The request signature we calculated does not match the signature you provided.</Message>
<AWSAccessKeyId>{ACCESS_KEY_ID}</AWSAccessKeyId>
<StringToSign>AWS4-HMAC-SHA256 20260904T000000Z {PRESIGNED_SIGNATURE}</StringToSign>
<CanonicalRequest>PUT /{BUCKET}/{ROOT_PREFIX} host:{ENDPOINT}</CanonicalRequest>
</Error>""".encode()

SERVICE_UNAVAILABLE = b"<Error><Code>ServiceUnavailable</Code></Error>"


class SpacesStub:
    """A stand-in for a Space that records what the adapter sent it."""

    def __init__(
        self,
        *,
        download_body: bytes = b"",
        error_status: int | None = None,
        error_body: bytes = SERVICE_UNAVAILABLE,
        transport_error: bool = False,
        upload_id: str | None = "EXAMPLEUPLOADID",
        error_inside_completion: bool = False,
        redirect: bool = False,
        endpoint: str = ENDPOINT,
    ) -> None:
        self.endpoint = endpoint
        self.download_body = download_body
        self.error_status = error_status
        self.error_body = error_body
        self.transport_error = transport_error
        self.upload_id = upload_id
        self.error_inside_completion = error_inside_completion
        self.redirect = redirect
        self.requests: list[httpx.Request] = []
        self.parts: dict[int, bytes] = {}
        self.single_request_body: bytes | None = None
        self.abandoned = False

    @property
    def client(self) -> httpx.Client:
        return httpx.Client(
            base_url=self.endpoint,
            transport=httpx.MockTransport(self._handle),
            auth=SigV4Auth(
                Credentials(
                    access_key_id=ACCESS_KEY_ID,
                    secret_access_key=SECRET_ACCESS_KEY,
                    region=REGION,
                )
            ),
        )

    @property
    def paths(self) -> list[str]:
        return [request.url.path for request in self.requests]

    @property
    def uploaded(self) -> bytes:
        """Everything the stub received as file content, reassembled in order."""
        if self.single_request_body is not None:
            return self.single_request_body
        return b"".join(self.parts[number] for number in sorted(self.parts))

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.transport_error:
            raise httpx.ConnectError(f"could not reach {PRESIGNED_URL}", request=request)
        if self.redirect:
            return httpx.Response(307, headers={"Location": PRESIGNED_URL})
        if self.error_status is not None:
            return httpx.Response(self.error_status, content=self.error_body)
        return self._route(request)

    def _route(self, request: httpx.Request) -> httpx.Response:
        """A multipart upload is named by its query, a plain object by its method."""
        params = request.url.params
        if "uploads" in params:
            return self._opened()
        if "partNumber" in params:
            return self._part(request)
        if "uploadId" in params:
            return self._session(request)
        return self._object(request)

    def _session(self, request: httpx.Request) -> httpx.Response:
        if request.method == "DELETE":
            self.abandoned = True
            return httpx.Response(204)
        return self._completed()

    def _object(self, request: httpx.Request) -> httpx.Response:
        if request.method == "PUT":
            self.single_request_body = request.content
            return httpx.Response(200, headers={"ETag": '"single-etag"'})
        if request.method == "GET":
            return httpx.Response(200, content=self.download_body)
        if request.method == "DELETE":
            # Idempotent, and the same answer for a key the store never held.
            return httpx.Response(204)
        return httpx.Response(404, content=b"<Error><Code>NoSuchKey</Code></Error>")

    def _opened(self) -> httpx.Response:
        inner = "" if self.upload_id is None else f"<UploadId>{self.upload_id}</UploadId>"
        return httpx.Response(
            200, content=f"<InitiateMultipartUploadResult>{inner}</InitiateMultipartUploadResult>"
        )

    def _part(self, request: httpx.Request) -> httpx.Response:
        number = int(request.url.params["partNumber"])
        self.parts[number] = request.content
        return httpx.Response(200, headers={"ETag": f'"etag-{number}"'})

    def _completed(self) -> httpx.Response:
        if self.error_inside_completion:
            # A 200 that says it failed. `is_error` is False for this.
            return httpx.Response(200, content=b"<Error><Code>InternalError</Code></Error>")
        return httpx.Response(200, content=b"<CompleteMultipartUploadResult/>")


def _store(stub: SpacesStub, *, single_request_ceiling: int | None = None) -> SpacesDocumentStore:
    kwargs = (
        {} if single_request_ceiling is None else {"single_request_ceiling": single_request_ceiling}
    )
    return SpacesDocumentStore(bucket=BUCKET, root_prefix=ROOT_PREFIX, http=stub.client, **kwargs)


def _upload(store: SpacesDocumentStore, body: bytes, filename: str = "deck.pdf") -> StoredItem:
    return store.upload(
        folder=FOLDER,
        filename=filename,
        content=io.BytesIO(body),
        size_bytes=len(body),
        content_type="application/pdf",
    )


# --- Upload: one request vs many parts --------------------------------------


def test_a_small_file_uploads_in_a_single_request():
    stub = SpacesStub()
    _upload(_store(stub, single_request_ceiling=64), b"a short deck")

    assert stub.uploaded == b"a short deck"
    assert not any("uploads" in request.url.params for request in stub.requests)


def test_a_file_above_the_ceiling_uploads_in_parts():
    stub = SpacesStub()
    _upload(_store(stub, single_request_ceiling=8), b"a deck too large for one request")

    assert any("uploads" in request.url.params for request in stub.requests)


def test_a_multipart_upload_arrives_intact():
    stub = SpacesStub()
    body = bytes(range(256)) * 40
    _upload(_store(stub, single_request_ceiling=8), body)

    assert stub.uploaded == body


def test_a_multipart_upload_numbers_its_parts_from_one_without_gaps():
    stub = SpacesStub()
    body = b"0123456789" * 3
    _upload(_store(stub, single_request_ceiling=8), body)

    assert sorted(stub.parts) == list(range(1, len(stub.parts) + 1))
    assert len(stub.uploaded) == len(body)


def test_a_multipart_upload_names_every_part_it_stored_when_it_completes():
    stub = SpacesStub()
    _upload(_store(stub, single_request_ceiling=8), b"a deck too large for one request")

    completion = next(r for r in stub.requests if r.method == "POST" and "uploadId" in r.url.params)
    for number in sorted(stub.parts):
        assert f"<PartNumber>{number}</PartNumber>" in completion.content.decode()


def test_the_default_ceiling_sends_a_file_at_the_ceiling_in_one_request():
    stub = SpacesStub()
    _upload(_store(stub), b"\0" * SINGLE_REQUEST_CEILING)

    assert not any("uploads" in request.url.params for request in stub.requests)


def test_the_default_ceiling_sends_a_larger_file_in_parts():
    stub = SpacesStub()
    _upload(_store(stub), b"\0" * (SINGLE_REQUEST_CEILING + 1))

    assert any("uploads" in request.url.params for request in stub.requests)


def test_every_part_but_the_last_meets_the_stores_minimum_part_size():
    """S3 refuses a short part outright, so the default has to clear 5 MiB."""
    stub = SpacesStub()
    _upload(_store(stub), b"\0" * (UPLOAD_PART_SIZE + 1))

    ordered = [stub.parts[number] for number in sorted(stub.parts)]
    assert len(ordered) > 1
    assert all(len(part) >= MINIMUM_PART_SIZE for part in ordered[:-1])


def test_a_short_read_raises_the_store_error():
    class ShortStream(io.BytesIO):
        def read(self, size: int = -1) -> bytes:
            return b""

    with pytest.raises(DocumentStoreError):
        _store(SpacesStub(), single_request_ceiling=8).upload(
            folder=FOLDER,
            filename="deck.pdf",
            content=ShortStream(b"a deck too large for one request"),
            size_bytes=31,
            content_type="application/pdf",
        )


# --- The key is the identifier ----------------------------------------------


def test_the_stored_item_names_the_key_the_object_was_written_to():
    stub = SpacesStub()
    stored = _upload(_store(stub, single_request_ceiling=64), b"a short deck")

    (path,) = stub.paths
    assert path == f"/{BUCKET}/{stored.item_id}"


def test_the_upload_lands_under_the_prefix_and_the_folder_it_was_given():
    stored = _upload(_store(SpacesStub(), single_request_ceiling=64), b"a short deck")

    assert stored.item_id.startswith(f"{ROOT_PREFIX}/{FOLDER}/")
    assert stored.item_id.endswith("/deck.pdf")


def test_two_uploads_of_the_same_name_to_one_pitch_get_different_keys():
    """The store assigns no id, so the adapter has to. Sharing a key would mean
    deleting one attachment took the other's bytes."""
    store = _store(SpacesStub(), single_request_ceiling=64)

    first = _upload(store, b"the first deck")
    second = _upload(store, b"the second deck")

    assert first.item_id != second.item_id


@pytest.mark.parametrize(
    "filename",
    ["../../secrets.pdf", "/etc/secrets.pdf", "C:\\decks\\secrets.pdf", "sub/dir/secrets.pdf"],
)
def test_a_filename_carrying_a_path_still_lands_in_its_own_folder(filename):
    stub = SpacesStub()
    stored = _upload(_store(stub, single_request_ceiling=64), b"x", filename=filename)

    assert stored.item_id.startswith(f"{ROOT_PREFIX}/{FOLDER}/")
    assert stored.item_id.endswith("/secrets.pdf")
    assert stored.item_id.count("/") == 3


@pytest.mark.parametrize("filename", ["", ".", "..", "/"])
def test_a_filename_that_names_no_file_is_refused(filename):
    with pytest.raises(DocumentStoreError):
        _upload(_store(SpacesStub(), single_request_ceiling=64), b"x", filename=filename)


def test_a_very_long_filename_produces_a_key_the_record_can_hold():
    """`store_item_id` is a VARCHAR(255). Postgres enforces that and SQLite does
    not, so an unbounded key would pass every test here and then fail in
    production after the object had already been written."""
    stored = _upload(
        _store(SpacesStub(), single_request_ceiling=64), b"x", filename=f"{'deck' * 200}.pdf"
    )

    assert len(stored.item_id) <= MAX_ITEM_ID_BYTES
    assert stored.item_id.endswith(".pdf")


def test_a_filename_of_unusual_characters_still_produces_a_usable_key():
    stub = SpacesStub()
    stored = _upload(
        _store(stub, single_request_ceiling=64), b"x", filename="pitch déck (v2) final.pdf"
    )

    (path,) = stub.paths
    assert path == f"/{BUCKET}/{stored.item_id}"
    assert stored.item_id.endswith(".pdf")


@pytest.mark.parametrize(
    "item_id", ["", "../etc/passwd", "pitches//deck.pdf", "elsewhere/deck.pdf"]
)
def test_an_item_outside_the_prefix_is_refused(item_id):
    stub = SpacesStub()

    with pytest.raises(DocumentStoreError):
        _store(stub).delete(item_id)
    with pytest.raises(DocumentStoreError):
        list(_store(stub).download(item_id))

    assert stub.requests == []


def test_a_compatible_store_on_another_endpoint_is_addressed_and_signed_the_same_way():
    """`SPACES_ENDPOINT` points local development at MinIO, which is plain HTTP on
    a port. The host that gets signed has to be the host that is sent, port and
    all — a store that reconstructs a different one refuses a signature it cannot
    reproduce, and says only that it did not match.
    """
    stub = SpacesStub(endpoint="http://minio:9000")
    stored = _upload(_store(stub, single_request_ceiling=64), b"a short deck")

    (request,) = stub.requests
    assert request.headers["host"] == "minio:9000"
    assert "SignedHeaders=host;x-amz-content-sha256;x-amz-date," in request.headers["authorization"]
    assert request.url.path == f"/{BUCKET}/{stored.item_id}"
    assert stub.uploaded == b"a short deck"


# --- An unconfigured store is a store failure, not a crash ------------------


def _unconfigured() -> SpacesDocumentStore:
    """What the app builds when the SPACES_* settings are left empty."""
    return SpacesDocumentStore(
        bucket="",
        root_prefix=ROOT_PREFIX,
        http=httpx.Client(base_url="https://.digitaloceanspaces.com"),
    )


def test_an_unconfigured_store_refuses_an_upload_as_a_store_failure():
    """The settings default to empty so the app boots without them, which makes
    this reachable in a deployed environment. It has to be the 502 the route
    already handles — an endpoint with an empty host label otherwise raises
    something the route does not catch, and the caller gets a 500."""
    with pytest.raises(DocumentStoreError):
        _upload(_unconfigured(), b"x")


def test_an_unconfigured_store_refuses_a_download_as_a_store_failure():
    with pytest.raises(DocumentStoreError):
        list(_unconfigured().download(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf"))


def test_an_unconfigured_store_refuses_a_delete_as_a_store_failure():
    with pytest.raises(DocumentStoreError):
        _unconfigured().delete(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf")


# --- Failures are typed -----------------------------------------------------


def test_a_store_error_on_a_single_request_upload_raises_the_store_error():
    with pytest.raises(DocumentStoreError):
        _upload(_store(SpacesStub(error_status=503), single_request_ceiling=64), b"x")


def test_a_store_error_while_starting_a_multipart_upload_raises_the_store_error():
    with pytest.raises(DocumentStoreError):
        _upload(_store(SpacesStub(error_status=503), single_request_ceiling=1), b"xx")


def test_a_multipart_upload_the_store_never_started_raises_the_store_error():
    with pytest.raises(DocumentStoreError):
        _upload(_store(SpacesStub(upload_id=None), single_request_ceiling=1), b"xx")


def test_an_error_inside_a_two_hundred_on_completion_raises_the_store_error():
    """The status is committed before the assembly finishes, so a failure arrives
    as a 200 with an error body. Trusting the status would record an attachment
    pointing at an object that was never assembled."""
    with pytest.raises(DocumentStoreError):
        _upload(
            _store(SpacesStub(error_inside_completion=True), single_request_ceiling=8),
            b"a deck too large for one request",
        )


def test_a_failing_part_abandons_the_multipart_upload():
    """Parts already accepted are stored and billed until the upload is abandoned,
    and nothing expires them the way a Graph session expired itself."""

    class FailingPart(SpacesStub):
        def _part(self, request):
            super()._part(request)
            return httpx.Response(503, content=SERVICE_UNAVAILABLE)

    stub = FailingPart()
    with pytest.raises(DocumentStoreError):
        _upload(_store(stub, single_request_ceiling=8), b"a deck too large for one request")

    assert stub.abandoned


def test_an_abandon_that_also_fails_still_raises_the_original_store_error():
    class FailingPartAndAbandon(SpacesStub):
        def _part(self, request):
            super()._part(request)
            return httpx.Response(503, content=SERVICE_UNAVAILABLE)

        def _handle(self, request):
            if request.method == "DELETE" and "uploadId" in request.url.params:
                self.requests.append(request)
                return httpx.Response(500, content=SERVICE_UNAVAILABLE)
            return super()._handle(request)

    with pytest.raises(DocumentStoreError):
        _upload(
            _store(FailingPartAndAbandon(), single_request_ceiling=8),
            b"a deck too large for one request",
        )


def test_a_transport_failure_raises_the_store_error():
    with pytest.raises(DocumentStoreError):
        _upload(_store(SpacesStub(transport_error=True), single_request_ceiling=64), b"x")


def test_a_store_error_on_download_raises_the_store_error():
    store = _store(SpacesStub(error_status=503))
    with pytest.raises(DocumentStoreError):
        list(store.download(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf"))


def test_a_missing_object_on_download_raises_the_store_error():
    store = _store(
        SpacesStub(error_status=404, error_body=b"<Error><Code>NoSuchKey</Code></Error>")
    )
    with pytest.raises(DocumentStoreError):
        list(store.download(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf"))


def test_a_redirect_on_download_raises_the_store_error():
    """Following it would re-send an Authorization signed for the old host and turn
    a wrong region into a signature error that says nothing about the cause."""
    store = _store(SpacesStub(redirect=True))
    with pytest.raises(DocumentStoreError):
        list(store.download(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf"))


def test_a_redirect_on_upload_raises_the_store_error():
    with pytest.raises(DocumentStoreError):
        _upload(_store(SpacesStub(redirect=True), single_request_ceiling=64), b"x")


def test_a_store_error_on_delete_raises_the_store_error():
    with pytest.raises(DocumentStoreError):
        _store(SpacesStub(error_status=503)).delete(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf")


# --- Download streams -------------------------------------------------------


def test_a_download_yields_the_stored_bytes():
    stub = SpacesStub(download_body=b"the stored deck bytes")

    assert b"".join(_store(stub).download(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf")) == (
        b"the stored deck bytes"
    )


def test_a_download_yields_more_than_one_chunk_for_a_large_file():
    stub = SpacesStub(download_body=b"\0" * (SINGLE_REQUEST_CEILING + 1))

    assert len(list(_store(stub).download(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf"))) > 1


def test_a_download_does_not_read_the_whole_object_before_yielding_its_first_chunk():
    """The interface returns an iterator so a deck is never held whole in memory —
    this is the assertion that property is real rather than incidental."""
    produced: list[bytes] = []
    blocks = 8

    def body():
        for _ in range(blocks):
            block = b"\0" * (64 * 1024)
            produced.append(block)
            yield block

    class Streaming(SpacesStub):
        def _handle(self, request):
            self.requests.append(request)
            return httpx.Response(200, content=body())

    chunks = _store(Streaming()).download(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf")
    first = next(iter(chunks))

    assert first
    assert len(produced) < blocks


# --- Delete -----------------------------------------------------------------


def test_a_delete_asks_the_store_to_remove_the_object_at_its_key():
    stub = SpacesStub()
    key = f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf"
    _store(stub).delete(key)

    (path,) = stub.paths
    assert path == f"/{BUCKET}/{key}"
    assert stub.requests[0].method == "DELETE"


def test_deleting_an_object_the_store_no_longer_has_is_not_an_error():
    """The caller's question is whether the file is gone, and for a key the store
    does not hold it is. Refusing would trap the record of a file someone had
    already removed out of band, with no way to clear it."""
    _store(SpacesStub()).delete(f"{ROOT_PREFIX}/{FOLDER}/never-stored/deck.pdf")


# --- No credential reaches the log stream or the caller ---------------------

CREDENTIALS = pytest.mark.parametrize(
    ("name", "credential"),
    [
        ("the secret access key", SECRET_ACCESS_KEY),
        ("the access key id", ACCESS_KEY_ID),
        ("a presigned signature", PRESIGNED_SIGNATURE),
    ],
    ids=["secret-access-key", "access-key-id", "presigned-signature"],
)


@CREDENTIALS
def test_no_log_line_from_a_multipart_upload_carries_a_credential(log_stream, name, credential):
    captured = log_stream("DEBUG")
    _upload(_store(SpacesStub(), single_request_ceiling=8), b"a deck too large for one request")

    assert credential not in captured.text(), f"{name} reached the log stream"


@CREDENTIALS
def test_no_log_line_from_a_download_carries_a_credential(log_stream, name, credential):
    captured = log_stream("DEBUG")
    list(_store(SpacesStub(download_body=b"bytes")).download(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf"))

    assert credential not in captured.text(), f"{name} reached the log stream"


@CREDENTIALS
def test_no_log_line_from_a_failing_upload_carries_a_credential(log_stream, name, credential):
    captured = log_stream("DEBUG")
    with pytest.raises(DocumentStoreError):
        _upload(_store(SpacesStub(error_status=503), single_request_ceiling=64), b"x")

    assert credential not in captured.text(), f"{name} reached the log stream"


def test_a_refused_signature_reports_nothing_the_store_echoed_back():
    """A 403 comes back carrying the string that was signed and the key id that
    signed it — exactly the values an error message quoting the body would leak."""
    with pytest.raises(DocumentStoreError) as refused:
        _upload(
            _store(
                SpacesStub(error_status=403, error_body=SIGNATURE_REFUSED),
                single_request_ceiling=64,
            ),
            b"x",
        )

    assert ACCESS_KEY_ID not in str(refused.value)
    assert PRESIGNED_SIGNATURE not in str(refused.value)
    assert "StringToSign" not in str(refused.value)


def test_a_transport_failure_reports_no_signature_to_the_caller():
    with pytest.raises(DocumentStoreError) as refused:
        _upload(_store(SpacesStub(transport_error=True), single_request_ceiling=64), b"x")

    assert PRESIGNED_SIGNATURE not in str(refused.value)


def test_a_download_returns_no_signed_url_to_its_caller():
    stub = SpacesStub(download_body=b"the stored deck bytes")
    body = b"".join(_store(stub).download(f"{ROOT_PREFIX}/{FOLDER}/id/deck.pdf"))

    assert PRESIGNED_SIGNATURE.encode() not in body
