import datetime as dt
from uuid import UUID

from pydantic import BaseModel


class ReceiptEvent(BaseModel):
    """1:1 com `receipt_events` (`db/migrations/*_create_receipt_events.sql`) — append-only."""

    id: UUID
    receipt_id: UUID
    from_status: str | None
    to_status: str
    detail: str | None
    created_at: dt.datetime
