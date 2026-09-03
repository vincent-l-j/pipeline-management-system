"""Attachment response schema — an allowlist, like every other `*Out`.

There is no `*Create` or `*Update` here, and that is the design rather than an
omission. The client chooses nothing about where a file goes: the folder is keyed
by the pitch's id and the uploader is the authenticated caller, both settled
server-side. An upload is a file and a pitch in the path, so there is no request
body to carry a path, folder, site or uploader field — and so no schema anyone can
be tempted to widen.

What is withheld from the response is `store_item_id`. It is an addressing detail
the client has no use for, and handing it out invites callers to fetch the file
from the document library directly, routing around the download endpoint — which
is the only thing enforcing who may read it.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AttachmentOut(BaseModel):
    id: UUID
    pitch_id: UUID
    filename: str
    content_type: str
    size_bytes: int
    # The uploader's name, not their id: a row shows who attached the file, and
    # the name is what it shows. Already visible to every authenticated caller
    # through the user directory, so this discloses nothing new — it just saves
    # the client a second request to resolve it.
    uploaded_by_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
