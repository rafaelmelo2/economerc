import datetime as dt
from uuid import UUID

from pydantic import BaseModel


class User(BaseModel):
    """1:1 com `users` (`db/migrations/20260926020000_create_users.sql`)."""

    id: UUID
    email: str | None
    display_name: str | None
    role: str
    last_login_at: dt.datetime | None
    created_at: dt.datetime
    updated_at: dt.datetime
    deleted_at: dt.datetime | None
