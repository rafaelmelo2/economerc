"""Repositório de `receipt_items` (skill `database`). Sem soft-delete — a nota é imutável."""

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from asyncpg import Connection


@dataclass(frozen=True, slots=True)
class NewReceiptItem:
    receipt_id: UUID
    line_number: int
    raw_name: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    market_code: str | None = None
    ean: str | None = None
    ncm: str | None = None
    unit: str | None = None
    product_id: UUID | None = None


class ReceiptItemRepository:
    async def create(self, conn: Connection, item: NewReceiptItem) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO receipt_items (receipt_id, line_number, market_code, ean, raw_name,
                                        ncm, quantity, unit, unit_price, total_price, product_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            """,
            item.receipt_id,
            item.line_number,
            item.market_code,
            item.ean,
            item.raw_name,
            item.ncm,
            item.quantity,
            item.unit,
            item.unit_price,
            item.total_price,
            item.product_id,
        )
        return dict(row)

    async def list_by_receipt(self, conn: Connection, receipt_id: UUID) -> list[dict]:
        rows = await conn.fetch(
            "SELECT * FROM receipt_items WHERE receipt_id = $1 ORDER BY line_number", receipt_id
        )
        return [dict(row) for row in rows]


receipt_item_repository = ReceiptItemRepository()
