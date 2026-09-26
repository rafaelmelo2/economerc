from uuid import UUID

from pydantic import BaseModel


class CityResponse(BaseModel):
    id: UUID
    state_code: str
    ibge_code: int
    name: str
    is_active: bool
