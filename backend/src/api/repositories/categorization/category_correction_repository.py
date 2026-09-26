"""Ledger append-only de correção manual de categoria (skill `database`)."""

from dataclasses import dataclass
from uuid import UUID

from asyncpg import Connection


@dataclass(frozen=True, slots=True)
class NewCategoryCorrection:
    product_id: UUID
    previous_category_id: UUID | None
    category_id: UUID
    corrected_by: UUID


class CategoryCorrectionRepository:
    async def create(self, conn: Connection, correction: NewCategoryCorrection) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO category_corrections (product_id, previous_category_id, category_id,
                                               corrected_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            correction.product_id,
            correction.previous_category_id,
            correction.category_id,
            correction.corrected_by,
        )
        return dict(row)

    async def list_by_product(self, conn: Connection, product_id: UUID) -> list[dict]:
        rows = await conn.fetch(
            "SELECT * FROM category_corrections WHERE product_id = $1 ORDER BY created_at DESC",
            product_id,
        )
        return [dict(row) for row in rows]


category_correction_repository = CategoryCorrectionRepository()
