"""Repositório de `cart_items` (skill `database`). Upsert idempotente por
`(user_id, client_id)`; `cart_client_id` é gravado só na criação (imutável).
"""

import datetime as dt
from decimal import Decimal
from typing import Any, Final
from uuid import UUID

from asyncpg import Connection

DEFAULT_CART_ITEM_QUANTITY: Final = Decimal("1")  # espelha o DEFAULT da coluna
DEFAULT_CART_ITEM_UNIT: Final = "un"  # espelha o DEFAULT da coluna


class CartItemRepository:
    async def get_by_client_id(
        self, conn: Connection, user_id: UUID, client_id: UUID
    ) -> dict | None:
        row = await conn.fetchrow(
            "SELECT * FROM cart_items WHERE user_id = $1 AND client_id = $2",
            user_id,
            client_id,
        )
        return dict(row) if row else None

    async def create(
        self,
        conn: Connection,
        user_id: UUID,
        client_id: UUID,
        cart_id: UUID,
        cart_client_id: UUID,
        fields: dict[str, Any],
        field_versions: dict[str, str],
        updated_at: dt.datetime,
    ) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO cart_items (
                cart_id, cart_client_id, user_id, client_id, product_id, ean,
                product_name, unit_price, quantity, unit, is_offer,
                field_versions, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
            """,
            cart_id,
            cart_client_id,
            user_id,
            client_id,
            fields.get("product_id"),
            fields.get("ean"),
            fields["product_name"],
            fields["unit_price"],
            fields.get("quantity") or DEFAULT_CART_ITEM_QUANTITY,
            fields.get("unit") or DEFAULT_CART_ITEM_UNIT,
            bool(fields.get("is_offer")),
            field_versions,
            updated_at,
        )
        return dict(row)

    async def update(
        self,
        conn: Connection,
        item_id: UUID,
        fields: dict[str, Any],
        field_versions_delta: dict[str, str],
        updated_at: dt.datetime,
    ) -> dict:
        """`cart_client_id` é imutável — nunca entra no SET (ver docstring do módulo)."""
        row = await conn.fetchrow(
            """
            UPDATE cart_items
               SET product_id      = COALESCE($2, product_id),
                   ean              = COALESCE($3, ean),
                   product_name     = COALESCE($4, product_name),
                   unit_price       = COALESCE($5, unit_price),
                   quantity         = COALESCE($6, quantity),
                   unit             = COALESCE($7, unit),
                   is_offer         = COALESCE($8, is_offer),
                   field_versions   = field_versions || $9::jsonb,
                   updated_at       = $10
             WHERE id = $1
             RETURNING *
            """,
            item_id,
            fields.get("product_id"),
            fields.get("ean"),
            fields.get("product_name"),
            fields.get("unit_price"),
            fields.get("quantity"),
            fields.get("unit"),
            fields.get("is_offer"),
            field_versions_delta,
            updated_at,
        )
        return dict(row)

    async def soft_delete(
        self,
        conn: Connection,
        item_id: UUID,
        field_versions_delta: dict[str, str],
        updated_at: dt.datetime,
    ) -> dict:
        row = await conn.fetchrow(
            """
            UPDATE cart_items
               SET deleted_at     = $2,
                   field_versions = field_versions || $3::jsonb,
                   updated_at     = $2
             WHERE id = $1
             RETURNING *
            """,
            item_id,
            updated_at,
            field_versions_delta,
        )
        return dict(row)


cart_item_repository = CartItemRepository()
