import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

MarketSourceKind = Literal["site", "whatsapp_group", "whatsapp_broadcast", "instagram", "flyer_pdf"]


class MarketSource(BaseModel):
    """1:1 com `market_sources` (`db/migrations/*_create_market_sources.sql`)."""

    id: UUID
    market_id: UUID
    kind: MarketSourceKind
    identifier: str
    is_active: bool
    last_success_at: dt.datetime | None
    last_error_at: dt.datetime | None
    last_error: str | None
    created_at: dt.datetime
    updated_at: dt.datetime
