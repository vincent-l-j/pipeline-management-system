"""AWS Signature Version 4, for reaching an S3-compatible object store.

Signed here rather than by boto3, and the reason is the test suite rather than the
dependency. `tests/test_document_store.py` runs its adapter over a *real*
`httpx.Client` because the credential leak those assertions exist to catch came
from the HTTP client's own log line; boto3's seams all sit above the transport, so
that property would be lost. Signing is a closed algorithm with published vectors,
which is the cheapest thing here to own outright.

`canonical_request` and `sign_request` are separate and public so both can be
pinned against AWS's own test suite — the algorithm's failure mode is a 403 that
does not say what differed, so being able to compare an intermediate string
against a third party's is the difference between a minute and an afternoon.

Nothing in this module logs. The secret is a constructor argument and the derived
key is held in memory; neither belongs in a message, and the only value that ever
leaves is the HMAC.
"""

import hashlib
import hmac
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from urllib.parse import parse_qsl, quote

import httpx

ALGORITHM = "AWS4-HMAC-SHA256"
TERMINATOR = "aws4_request"

EMPTY_PAYLOAD_SHA256 = hashlib.sha256(b"").hexdigest()


@dataclass(frozen=True)
class Credentials:
    """Who is signing, and for which store.

    Frozen so it can key the signing-key cache below, which is what lets the key
    be derived once a day rather than four HMACs per request.
    """

    access_key_id: str
    secret_access_key: str
    region: str
    service: str = "s3"


def _canonical_uri(url: httpx.URL) -> str:
    """The path exactly as it goes on the wire.

    Taken from the raw path rather than rebuilt from the decoded one, because S3
    is the single service that does *not* re-encode the canonical URI. Rebuilding
    it would turn a `%20` in the request line into a `%2520` in the signature, and
    the store's refusal does not say which of the two it disagreed with.
    """
    path = url.raw_path.split(b"?", 1)[0].decode()
    return path or "/"


def _canonical_query(url: httpx.URL) -> str:
    """Every parameter encoded, then sorted by encoded name and value.

    Decoded and re-encoded rather than sorted as-received, so the signed form is
    canonical no matter how the caller spelled it. Every value this app sends is
    already encoded the same way, so the round trip is a no-op in practice and a
    guard in principle.
    """
    # `safe=""` is exactly RFC 3986's unreserved set here: `quote` never touches
    # the alphanumerics or `-._~`, and leaving nothing else safe is what encodes a
    # `/` inside a value the way AWS expects.
    pairs = sorted(
        (quote(name, safe=""), quote(value, safe=""))
        for name, value in parse_qsl(url.query.decode(), keep_blank_values=True)
    )
    return "&".join(f"{name}={value}" for name, value in pairs)


def _canonical_headers(headers: dict[str, str]) -> tuple[str, str]:
    """The signed headers, lowercased and sorted, with their runs of space folded."""
    folded = sorted((name.lower(), " ".join(str(value).split())) for name, value in headers.items())
    canonical = "".join(f"{name}:{value}\n" for name, value in folded)
    return canonical, ";".join(name for name, _ in folded)


def canonical_request(
    *,
    method: str,
    url: httpx.URL,
    headers: dict[str, str],
    payload_hash: str,
) -> str:
    """The request as the store will reconstruct it before checking the signature."""
    canonical_headers, signed_headers = _canonical_headers(headers)
    return "\n".join(
        [
            method.upper(),
            _canonical_uri(url),
            _canonical_query(url),
            canonical_headers,
            signed_headers,
            payload_hash,
        ]
    )


@lru_cache(maxsize=2)
def _signing_key(credentials: Credentials, date_stamp: str) -> bytes:
    """Four chained HMACs, derived once per day rather than once per request.

    Two entries, so the day's key and the one either side of a rollover are both
    held: a cache of one would re-derive on every request for the minutes either
    side of midnight UTC.
    """
    key = f"AWS4{credentials.secret_access_key}".encode()
    for message in (date_stamp, credentials.region, credentials.service, TERMINATOR):
        key = hmac.new(key, message.encode(), hashlib.sha256).digest()
    return key


def sign_request(
    *,
    method: str,
    url: httpx.URL,
    headers: dict[str, str],
    payload_hash: str,
    credentials: Credentials,
    moment: datetime,
) -> str:
    """The finished `Authorization` value for one request."""
    amz_date = moment.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = moment.strftime("%Y%m%d")
    scope = f"{date_stamp}/{credentials.region}/{credentials.service}/{TERMINATOR}"

    built = canonical_request(method=method, url=url, headers=headers, payload_hash=payload_hash)
    string_to_sign = "\n".join(
        [ALGORITHM, amz_date, scope, hashlib.sha256(built.encode()).hexdigest()]
    )
    signature = hmac.new(
        _signing_key(credentials, date_stamp), string_to_sign.encode(), hashlib.sha256
    ).hexdigest()

    _, signed_headers = _canonical_headers(headers)
    return (
        f"{ALGORITHM} Credential={credentials.access_key_id}/{scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )


class SigV4Auth(httpx.Auth):
    """Signs every request an `httpx.Client` sends, so the store adapter cannot forget to."""

    # The signature covers a hash of the body, so httpx has to have read it before
    # `auth_flow` runs.
    requires_request_body = True

    def __init__(
        self, credentials: Credentials, *, clock: Callable[[], datetime] | None = None
    ) -> None:
        self._credentials = credentials
        # Injectable so a signature can be pinned against a fixed moment; nothing
        # in the app passes it. More than 15 minutes of skew is a hard refusal, so
        # this is deliberately the real clock in UTC rather than anything derived.
        self._clock = clock or (lambda: datetime.now(UTC))

    def auth_flow(self, request: httpx.Request) -> Iterator[httpx.Request]:
        moment = self._clock()
        request.headers["x-amz-date"] = moment.strftime("%Y%m%dT%H%M%SZ")
        # Always the real hash, never UNSIGNED-PAYLOAD: every body this app sends
        # is a bounded chunk it already holds, so hashing costs nothing and the
        # store's acceptance of the unsigned form stops mattering.
        request.headers["x-amz-content-sha256"] = hashlib.sha256(request.content).hexdigest()

        # Host and the store's own headers, and nothing else. Signing whatever
        # httpx happened to add would make the signature depend on transport
        # details — a Content-Length appearing or not is not a thing to debug.
        signable = {
            name.lower(): value
            for name, value in request.headers.items()
            if name.lower() == "host" or name.lower().startswith("x-amz-")
        }

        request.headers["Authorization"] = sign_request(
            method=request.method,
            url=request.url,
            headers=signable,
            payload_hash=signable["x-amz-content-sha256"],
            credentials=self._credentials,
            moment=moment,
        )
        yield request
