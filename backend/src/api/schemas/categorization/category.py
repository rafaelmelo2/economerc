from uuid import UUID

from pydantic import BaseModel, Field


class ProductCategoryUpdateRequest(BaseModel):
    category_id: UUID


class ProductCategoryResponse(BaseModel):
    product_id: UUID
    category_id: UUID
    category_slug: str
    category_name: str
    category_source: str


class CategorizationRunRequest(BaseModel):
    limit: int = Field(default=100, ge=1, le=500)


class CategorizationRunResponse(BaseModel):
    processed: int
    categorized: int
    by_source: dict[str, int]
