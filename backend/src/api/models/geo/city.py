from uuid import UUID

from pydantic import BaseModel


class City(BaseModel):
    """1:1 com `cities` (`db/migrations/*_create_cities.sql`)."""

    id: UUID
    state_code: str
    ibge_code: int
    name: str
    is_active: bool
