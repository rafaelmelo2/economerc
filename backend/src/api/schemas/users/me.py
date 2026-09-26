import datetime as dt
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from api.schemas.users.user import UserResponse


class PreferencesResponse(BaseModel):
    user_id: UUID
    city_id: UUID | None
    household_size: int | None
    monthly_budget: Decimal | None
    budget_alert_percent: int
    updated_at: dt.datetime


class MeResponse(UserResponse):
    preferences: PreferencesResponse | None


class UpdatePreferencesRequest(BaseModel):
    """PATCH parcial — campo omitido preserva o valor atual (COALESCE no repo)."""

    city_id: UUID | None = None
    household_size: int | None = Field(default=None, ge=1, le=20)
    monthly_budget: Decimal | None = Field(default=None, ge=0)
    budget_alert_percent: int | None = Field(default=None, ge=50, le=100)
