from uuid import UUID

from pydantic import BaseModel


class CategoryResponse(BaseModel):
    id: UUID
    parent_id: UUID | None
    slug: str
    name: str
    icon: str
    ncm_prefixes: list[str]
    position: int
