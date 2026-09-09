"""Removing a pitch's files from the document store."""

from collections.abc import Iterable

from app.services.document_store import DocumentStore


def purge_stored_files(store: DocumentStore, item_ids: Iterable[str]) -> None:
    """Every file gone from the store, or `DocumentStoreError` from the first refusal.

    Ids rather than attachment rows, so this stays below the model layer and the
    caller decides what a failure means for its own records.

    Stopping at the first refusal rather than pressing on: the files not yet
    reached are still there, so the caller that keeps its rows keeps a record
    pointing at each of them.
    """
    for item_id in item_ids:
        store.delete(item_id)
