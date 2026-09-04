"""Signature Version 4, checked against vectors we did not write.

The published `get-vanilla` case from AWS's own signing test suite is the anchor:
it pins the canonical request and the finished Authorization header against a
third party, which is the only way to be confident about an algorithm whose
failure mode is a 403 with no explanation of what differed.

Everything else here is a case that produces a *valid-looking* signature the store
then refuses, which is the expensive kind to debug.
"""

import hashlib
from datetime import UTC, datetime

import httpx
import pytest

from app.services.sigv4 import (
    EMPTY_PAYLOAD_SHA256,
    Credentials,
    SigV4Auth,
    canonical_request,
    sign_request,
)

# The suite's fixed credentials and moment. Not a real key.
VECTOR = Credentials(
    access_key_id="AKIDEXAMPLE",
    secret_access_key="wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    region="us-east-1",
    service="service",
)
VECTOR_MOMENT = datetime(2015, 8, 30, 12, 36, 0, tzinfo=UTC)
VECTOR_HEADERS = {"host": "example.amazonaws.com", "x-amz-date": "20150830T123600Z"}

SPACES = Credentials(
    access_key_id="DO00EXAMPLEACCESSKEYID",
    secret_access_key="Xy7+n0tAr3alSp4c3sS3cr3t/K3y0123456789abcdefgh",
    region="syd1",
)


def _canonical_uri(request_url: str) -> str:
    """The second line of the canonical request — the part S3 must not re-encode."""
    return canonical_request(
        method="GET",
        url=httpx.URL(request_url),
        headers=VECTOR_HEADERS,
        payload_hash=EMPTY_PAYLOAD_SHA256,
    ).split("\n")[1]


def _canonical_query(request_url: str) -> str:
    return canonical_request(
        method="GET",
        url=httpx.URL(request_url),
        headers=VECTOR_HEADERS,
        payload_hash=EMPTY_PAYLOAD_SHA256,
    ).split("\n")[2]


# --- The published vector ---------------------------------------------------


def test_the_canonical_request_matches_the_published_test_vector():
    built = canonical_request(
        method="GET",
        url=httpx.URL("https://example.amazonaws.com/"),
        headers=VECTOR_HEADERS,
        payload_hash=EMPTY_PAYLOAD_SHA256,
    )

    assert built == (
        "GET\n"
        "/\n"
        "\n"
        "host:example.amazonaws.com\n"
        "x-amz-date:20150830T123600Z\n"
        "\n"
        "host;x-amz-date\n"
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )


def test_the_signature_matches_the_published_test_vector():
    authorization = sign_request(
        method="GET",
        url=httpx.URL("https://example.amazonaws.com/"),
        headers=VECTOR_HEADERS,
        payload_hash=EMPTY_PAYLOAD_SHA256,
        credentials=VECTOR,
        moment=VECTOR_MOMENT,
    )

    assert authorization == (
        "AWS4-HMAC-SHA256 "
        "Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, "
        "SignedHeaders=host;x-amz-date, "
        "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31"
    )


# --- Encoding: the signature has to describe the bytes actually sent ---------


def test_a_path_is_not_double_encoded():
    """S3 is the one service that does not re-encode the canonical URI.

    Encoding it twice is the classic SignatureDoesNotMatch: the request line
    carries `%20` and the signature describes `%2520`, and nothing in the refusal
    says so.
    """
    assert _canonical_uri("https://s.example/bucket/my%20deck.pdf") == "/bucket/my%20deck.pdf"


def test_a_path_is_signed_exactly_as_it_goes_on_the_wire():
    url = httpx.URL("https://s.example/bucket/pitches/a-b_c.1.pdf")

    assert _canonical_uri(str(url)) == url.raw_path.split(b"?", 1)[0].decode()


def test_a_request_for_the_bucket_root_signs_a_single_slash():
    """An empty path is `/` in the canonical request, never the empty string."""
    assert _canonical_uri("https://s.example") == "/"


def test_a_query_string_is_canonicalised_in_sorted_order():
    """Sent in the order a part upload names them; signed in sorted order."""
    assert _canonical_query("https://s.example/k?partNumber=10&uploadId=abc") == (
        "partNumber=10&uploadId=abc"
    )


def test_a_query_string_out_of_order_signs_the_same_way():
    assert _canonical_query("https://s.example/k?uploadId=abc&partNumber=10") == (
        "partNumber=10&uploadId=abc"
    )


def test_a_valueless_query_parameter_signs_with_its_separator():
    """`?uploads` starts a multipart upload, and canonicalises to `uploads=`."""
    assert _canonical_query("https://s.example/k?uploads") == "uploads="


def test_a_reserved_character_in_a_query_value_is_encoded():
    assert _canonical_query("https://s.example/k?uploadId=a%2Fb") == "uploadId=a%2Fb"


# --- The signing key is scoped to a date ------------------------------------


def test_the_signature_changes_when_the_date_changes():
    """The signing key is derived per day and cached; a rollover must re-derive it
    rather than keep signing with yesterday's."""
    signed = [
        sign_request(
            method="GET",
            url=httpx.URL("https://example.amazonaws.com/"),
            headers=VECTOR_HEADERS,
            payload_hash=EMPTY_PAYLOAD_SHA256,
            credentials=VECTOR,
            moment=moment,
        )
        for moment in (VECTOR_MOMENT, VECTOR_MOMENT.replace(day=31))
    ]

    assert signed[0] != signed[1]


def test_the_same_request_on_the_same_day_signs_the_same_way():
    def signed():
        return sign_request(
            method="GET",
            url=httpx.URL("https://example.amazonaws.com/"),
            headers=VECTOR_HEADERS,
            payload_hash=EMPTY_PAYLOAD_SHA256,
            credentials=VECTOR,
            moment=VECTOR_MOMENT,
        )

    assert signed() == signed()


# --- What the signer puts on a real request ---------------------------------


def _signed(request: httpx.Request, credentials: Credentials = SPACES) -> httpx.Request:
    flow = SigV4Auth(credentials, clock=lambda: VECTOR_MOMENT).sync_auth_flow(request)
    return next(flow)


def test_a_signed_request_carries_the_moment_it_was_signed():
    request = _signed(httpx.Request("GET", "https://syd1.example/bucket/k"))

    assert request.headers["x-amz-date"] == "20150830T123600Z"


def test_a_signed_request_carries_the_hash_of_its_own_body():
    request = _signed(httpx.Request("PUT", "https://syd1.example/bucket/k", content=b"a deck"))

    assert request.headers["x-amz-content-sha256"] == hashlib.sha256(b"a deck").hexdigest()


def test_an_empty_body_is_hashed_rather_than_left_unsigned():
    """Never UNSIGNED-PAYLOAD: every body here is a bounded chunk we already hold,
    so hashing it is free and removes a dependence on the store accepting the
    unsigned form."""
    request = _signed(httpx.Request("DELETE", "https://syd1.example/bucket/k"))

    assert request.headers["x-amz-content-sha256"] == EMPTY_PAYLOAD_SHA256


def test_a_signed_request_covers_the_host_and_the_payload_hash():
    request = _signed(httpx.Request("PUT", "https://syd1.example/bucket/k", content=b"a deck"))

    assert "SignedHeaders=host;x-amz-content-sha256;x-amz-date," in request.headers["authorization"]


def test_a_signed_request_names_the_key_and_its_scope():
    request = _signed(httpx.Request("GET", "https://syd1.example/bucket/k"))

    assert (
        "Credential=DO00EXAMPLEACCESSKEYID/20150830/syd1/s3/aws4_request,"
        in (request.headers["authorization"])
    )


@pytest.mark.parametrize(
    "method,content",
    [("GET", None), ("PUT", b"a deck"), ("DELETE", None)],
)
def test_the_secret_access_key_never_appears_in_a_signed_request(method, content):
    """The HMAC of the secret must travel; the secret itself must not."""
    request = _signed(httpx.Request(method, "https://syd1.example/bucket/k", content=content))

    written = str(request.headers) + str(request.url) + str(request.content)
    assert SPACES.secret_access_key not in written
