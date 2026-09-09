"""The store a pitch's attachments live in, as an interface.

An ABC rather than a `Protocol`: there is no type checker on this backend, so a
structural interface would be checked by nothing.
"""

import abc
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import BinaryIO


@dataclass(frozen=True)
class StoredItem:
    item_id: str
    size_bytes: int


class DocumentStoreError(Exception):
    """The store failed, as distinct from the request being bad — a 502, not a 400."""


def leaf_name(filename: str) -> str:
    """The bare file name, with any path the caller sent stripped off.

    Removed rather than escaped: an HTTP client normalises the URL it is handed
    and decodes `%2F` straight back into a separator.
    """
    leaf = PurePosixPath(filename.replace("\\", "/")).name
    if leaf in {"", ".", ".."}:
        raise DocumentStoreError("The document store was given no usable file name")
    return leaf


class DocumentStore(abc.ABC):
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
        """A stream and a known size, so an implementation can send it in pieces."""

    @abc.abstractmethod
    def download(self, item_id: str) -> Iterator[bytes]:
        """An iterator, not `bytes`: this instance has 512 MB."""

    @abc.abstractmethod
    def delete(self, item_id: str) -> None: ...
