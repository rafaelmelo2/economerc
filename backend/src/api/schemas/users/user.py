import datetime as dt
from uuid import UUID

from pydantic import BaseModel


class UserResponse(BaseModel):
    """Perfil público — nunca inclui hash/token. Reusado por `/auth/*` e `/me`."""

    id: UUID
    email: str | None
    display_name: str | None
    role: str
    last_login_at: dt.datetime | None
    created_at: dt.datetime
