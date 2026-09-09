"""AWS Signature Version 4, for reaching an S3-compatible object store.

Owned rather than taken from boto3 so the adapter can be tested over a real
`httpx.Client`; boto3's seams sit above the transport. `canonical_request` is
public so it can be pinned against AWS's published vectors — the failure mode is a
403 that does not say what differed.

Nothing here logs: the only value that ever leaves is the HMAC.
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
    """Frozen so it can key `_signing_key`'s cache."""

    access_key_id: str
    secret_access_key: str
    region: str
    service: str = "s3"


def _canonical_uri(url: httpx.URL) -> str:
    """The path exactly as it goes on the wire.

    Raw, not rebuilt from the decoded path: S3 is the one service that does not
    re-encode the canonical URI, so rebuilding turns `%20` into `%2520`.
    """
    path = url.raw_path.split(b"?", 1)[0].decode()
    return path or "/"


def _canonical_query(url: httpx.URL) -> str:
    """Every parameter encoded, then sorted by encoded name and value."""
    # `safe=""` leaves RFC 3986's unreserved set alone and encodes everything
    # else — including a `/` inside a value, which is what AWS expects.
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
    """Four chained HMACs, derived once per day. Two entries so a midnight-UTC
    rollover does not re-derive on every request."""
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
        # Injectable so a signature can be pinned against a fixed moment. More
        # than 15 minutes of skew is a hard refusal, so this is the real clock.
        self._clock = clock or (lambda: datetime.now(UTC))

    def auth_flow(self, request: httpx.Request) -> Iterator[httpx.Request]:
        moment = self._clock()
        request.headers["x-amz-date"] = moment.strftime("%Y%m%dT%H%M%SZ")
        # Always the real hash, never UNSIGNED-PAYLOAD: every body here is a
        # bounded chunk already in memory, so hashing costs nothing.
        request.headers["x-amz-content-sha256"] = hashlib.sha256(request.content).hexdigest()

        # Host and the store's own headers only: signing whatever httpx added
        # would make the signature depend on transport details.
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
