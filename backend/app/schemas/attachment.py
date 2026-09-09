"""Attachment response schema.

`store_item_id` is withheld deliberately: a client holding it could fetch the
object directly and route around the download endpoint, which is the only thing
enforcing who may read the file.
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
    # The name, not the id: already public through the user directory, and it
    # saves the client a second request to resolve one.
    uploaded_by_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
