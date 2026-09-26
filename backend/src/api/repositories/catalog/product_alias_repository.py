"""Repositório de `product_aliases` (skill `database`). Sem soft-delete, sem endpoint HTTP
próprio nesta onda — consumido pelos futuros workers de NFC-e/crawler (Onda 4)."""

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from asyncpg import Connection


@dataclass(frozen=True, slots=True)
class NewProductAlias:
    market_id: UUID
    raw_name: str
    market_code: str | None = None
    product_id: UUID | None = None


class ProductAliasRepository:
    async def get_by_market_code(
        self, conn: Connection, market_id: UUID, market_code: str
    ) -> dict | None:
        row = await conn.fetchrow(
            "SELECT * FROM product_aliases WHERE market_id = $1 AND market_code = $2",
            market_id,
            market_code,
        )
        return dict(row) if row else None

    async def create(self, conn: Connection, alias: NewProductAlias) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO product_aliases (product_id, market_id, market_code, raw_name)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            """,
            alias.product_id,
            alias.market_id,
            alias.market_code,
            alias.raw_name,
        )
        return dict(row)

    async def link_product(self, conn: Connection, alias_id: UUID, product_id: UUID) -> dict | None:
        row = await conn.fetchrow(
            "UPDATE product_aliases SET product_id = $2 WHERE id = $1 RETURNING *",
            alias_id,
            product_id,
        )
        return dict(row) if row else None

    async def set_suggested_match(
        self, conn: Connection, alias_id: UUID, product_id: UUID, score: Decimal
    ) -> None:
        """Guarda a melhor sugestão do RapidFuzz (bloco 4C) mesmo sem auto-linkar."""
        await conn.execute(
            """
            UPDATE product_aliases
               SET suggested_product_id = $2, suggested_match_score = $3
             WHERE id = $1
            """,
            alias_id,
            product_id,
            score,
        )


product_alias_repository = ProductAliasRepository()
