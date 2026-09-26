import datetime as dt
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

CollectorRunStatus = Literal["running", "success", "failed"]


class CollectorRun(BaseModel):
    """1:1 com `collector_runs` (`db/migrations/*_create_collector_runs.sql`)."""

    id: UUID
    market_source_id: UUID | None
    collector: str
    status: CollectorRunStatus
    items_found: int
    aliases_created: int
    prices_created: int
    error_message: str | None
    started_at: dt.datetime
    finished_at: dt.datetime | None
