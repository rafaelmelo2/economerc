import datetime as dt
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class UserPreferences(BaseModel):
    """1:1 com `user_preferences` (`db/migrations/20260926030002_*.sql`)."""

    user_id: UUID
    city_id: UUID | None
    household_size: int | None
    monthly_budget: Decimal | None
    budget_alert_percent: int
    updated_at: dt.datetime
