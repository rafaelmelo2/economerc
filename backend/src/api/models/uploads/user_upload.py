import datetime as dt
from uuid import UUID

from pydantic import BaseModel


class UserUpload(BaseModel):
    """1:1 com `user_uploads` (`db/migrations/*_create_user_uploads.sql`)."""

    id: UUID
    owner_user_id: UUID
    kind: str
    entity_type: str | None
    entity_id: str | None
    url: str
    storage_key: str | None
    filename: str
    mime_type: str | None
    size_bytes: int
    width: int | None
    height: int | None
    visibility: str
    metadata: dict
    created_at: dt.datetime
    updated_at: dt.datetime
    deleted_at: dt.datetime | None
