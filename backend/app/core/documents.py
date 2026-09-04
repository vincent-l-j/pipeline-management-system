"""The edge where the concrete document store is chosen.

The one module that names an implementation. Routes declare
`Depends(get_document_store)` and receive a `DocumentStore`, exactly as they
declare `Depends(get_db)` and receive a `Session` — and, for the same reason,
tests replace it wholesale through `app.dependency_overrides` and run the whole
attachment surface against an in-memory fake.

Nothing here names a vendor beyond the adapter's own factory: the HTTP client and
the signing live inside `app/services/spaces.py`. Attachments are objects in a
DigitalOcean Space, and this is the single line that would change to put them
somewhere else — `store_item_id` is opaque to everything above, so a second
implementation of `DocumentStore` needs no migration and no schema change.
"""

from functools import lru_cache

from app.core.config import settings
from app.services.document_store import DocumentStore
from app.services.spaces import spaces_document_store


@lru_cache(maxsize=1)
def _build_store() -> DocumentStore:
    """Built once per process: the signing key cache and the connection pool are
    both worth keeping across requests, and neither is per-caller state.

    Lazy, so importing the app never reaches for a bucket — the tests override
    this dependency and the real adapter is never constructed under pytest.
    """
    return spaces_document_store(
        endpoint_url=settings.spaces_endpoint_url,
        region=settings.SPACES_REGION,
        bucket=settings.SPACES_BUCKET,
        root_prefix=settings.SPACES_ROOT_PREFIX,
        access_key_id=settings.SPACES_ACCESS_KEY_ID,
        secret_access_key=settings.SPACES_SECRET_ACCESS_KEY,
    )


def get_document_store() -> DocumentStore:
    """FastAPI dependency — the document store pitch attachments live in."""
    return _build_store()
