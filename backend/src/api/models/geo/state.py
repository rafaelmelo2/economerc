from pydantic import BaseModel


class State(BaseModel):
    """1:1 com `states` (`db/migrations/*_create_states.sql`)."""

    code: str
    ibge_code: int
    name: str
