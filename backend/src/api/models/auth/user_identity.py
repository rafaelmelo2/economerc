import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

AuthProvider = Literal["google", "apple"]


class UserIdentity(BaseModel):
    """1:1 com `user_identities` (`db/migrations/20260926030001_*.sql`)."""

    id: UUID
    user_id: UUID
    provider: AuthProvider
    subject: str
    email: str | None
    created_at: dt.datetime
