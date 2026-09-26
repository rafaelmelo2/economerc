from uuid import UUID

from pydantic import BaseModel


class Category(BaseModel):
    """1:1 com `categories` (`db/migrations/*_create_categories.sql`)."""

    id: UUID
    parent_id: UUID | None
    slug: str
    name: str
    icon: str
    ncm_prefixes: list[str]
    position: int
