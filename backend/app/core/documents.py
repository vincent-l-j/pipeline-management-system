"""The edge where the concrete document store is chosen.

The only module that names an implementation. `store_item_id` is opaque above
this line, so swapping the store is a change here and no migration.
"""

from functools import lru_cache

from app.core.config import settings
from app.services.document_store import DocumentStore
from app.services.spaces import spaces_document_store


@lru_cache(maxsize=1)
def _build_store() -> DocumentStore:
    """Once per process, for the signing-key cache and the connection pool.

    Lazy, so importing the app never reaches for a bucket.
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
