"""The store a pitch's attachments live in, as an interface.

Callers hold a `DocumentStore` and never name a vendor: the concrete adapter is
chosen in `app/core/documents.py` and injected, which is what lets the whole
attachment surface — including every failure path — run against an in-memory fake
with no tenant and no network.

An ABC rather than a `Protocol` on purpose. There is no type checker on this
backend, so a structural interface would be checked by nothing; `abc` refuses to
construct an implementation that has fallen behind the interface, which is a real
check at the moment it matters.
"""

import abc
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import BinaryIO


@dataclass(frozen=True)
class StoredItem:
    """Where a file landed, as the store reports it back."""

    item_id: str
    size_bytes: int


class DocumentStoreError(Exception):
    """The store could not do what was asked.

    Typed so a caller can tell it apart from a bad request: by the time this is
    raised the request was already acceptable and the *store* is what failed,
    which is a "try again later" answer rather than a "fix your request" one.
    """


def leaf_name(filename: str) -> str:
    """The bare file name, with any path the caller sent stripped off.

    Here rather than in one adapter because every store addresses a file by a
    string it builds from this name, so each of them has the same hole if it
    skips the strip. Escaping is not enough on its own: an HTTP client normalises
    the URL it is handed and decodes `%2F` straight back into a separator, so a
    name carrying one has to be *removed* rather than encoded. Backslashes count
    too — a file picked on Windows can arrive as `C:\\decks\\pitch.pdf`.

    The endpoint validates the name before this runs, so the refusal below is
    defence in depth rather than the check a user is expected to meet.
    """
    leaf = PurePosixPath(filename.replace("\\", "/")).name
    if leaf in {"", ".", ".."}:
        raise DocumentStoreError("The document store was given no usable file name")
    return leaf


class DocumentStore(abc.ABC):
    """Somewhere to put a file, get it back, and remove it."""

    @abc.abstractmethod
    def upload(
        self,
        *,
        folder: str,
        filename: str,
        content: BinaryIO,
        size_bytes: int,
        content_type: str,
    ) -> StoredItem:
        """Store `content` under `folder` and return where it went.

        Takes a stream and a known size rather than bytes, so an implementation
        can send a large file in pieces without holding all of it at once.
        """

    @abc.abstractmethod
    def download(self, item_id: str) -> Iterator[bytes]:
        """Yield the item's bytes in chunks.

        An iterator, not a `bytes`: the instance this runs on has 512 MB, and a
        pitch deck read whole into memory competes with everything else on it.
        """

    @abc.abstractmethod
    def delete(self, item_id: str) -> None:
        """Remove the item from the store."""
