import datetime as dt
from uuid import UUID

from pydantic import BaseModel


class RefreshToken(BaseModel):
    """1:1 com `refresh_tokens` (`db/migrations/20260926030003_*.sql`).

    `token_hash` é o SHA-256 hex do token opaco cru — o valor cru nunca é
    persistido (skill `auth` > auth-hardened.md §1/§3).
    """

    id: UUID
    user_id: UUID
    family: UUID
    family_created_at: dt.datetime
    used: bool
    token_hash: str
    revoked_at: dt.datetime | None
    expires_at: dt.datetime
    created_at: dt.datetime
