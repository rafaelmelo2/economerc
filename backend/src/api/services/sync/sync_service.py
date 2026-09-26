"""Orquestra `POST /sync/push`: valida regra de negócio, resolve LWW por
campo, grava e loga em `sync_changes`. Route → Service → Repository
(rules/backend.md > Architecture) — o service é o único lugar que decide
CREATE vs UPDATE vs tombstone; repositórios só executam SQL.

Decisão de design: **delete é terminal**. Depois de um tombstone, qualquer
upsert (mesmo com `updated_at` mais novo) é `ignored_stale` — não existe
"reabrir" carrinho/item pelo sync. Isso cobre com folga o critério de
aceite "delete + upsert atrasado não ressuscita" sem introduzir o caso
ambíguo de um upsert genuinamente mais novo que o delete.
"""

import datetime as dt
from decimal import Decimal
from typing import Any
from uuid import UUID

from asyncpg import Connection

from api.repositories.carts.cart_item_repository import cart_item_repository
from api.repositories.carts.cart_repository import cart_repository
from api.repositories.sync.sync_change_repository import sync_change_repository
from api.schemas.sync.push import CartItemMutation, CartMutation, SyncMutation, SyncPushItemResult
from api.services.sync.field_versions import latest_version, merge_field_versions

CART_ITEM_REQUIRED_ON_CREATE: tuple[str, ...] = ("cart_client_id", "product_name", "unit_price")

CART_SNAPSHOT_KEYS: tuple[str, ...] = ("market_id", "status", "budget", "started_at", "closed_at")
CART_ITEM_SNAPSHOT_KEYS: tuple[str, ...] = (
    "cart_client_id",
    "product_id",
    "ean",
    "product_name",
    "unit_price",
    "quantity",
    "unit",
    "is_offer",
)


def _json_safe(value: Any) -> Any:
    """`sync_changes.payload` é JSONB via codec orjson (config/database.py) —
    orjson não serializa `Decimal` nativamente, então vira string decimal
    (mesma regra de "dinheiro nunca em float" vale na leitura do pull)."""
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dt.datetime):
        return value.isoformat()
    return value


def _snapshot(row: dict, keys: tuple[str, ...]) -> dict[str, Any]:
    return {key: _json_safe(row.get(key)) for key in keys}


async def apply_push_batch(
    conn: Connection, user_id: UUID, mutations: list[SyncMutation]
) -> list[SyncPushItemResult]:
    """Processa o lote sequencialmente numa única transação (o caller abre
    `conn.transaction()`) — ordem importa: um `cart_item` referencia o
    `cart_client_id` do carrinho que precisa ter sido processado antes."""
    results = []
    for mutation in mutations:
        if isinstance(mutation, CartMutation):
            results.append(await _apply_cart_mutation(conn, user_id, mutation))
        else:
            results.append(await _apply_cart_item_mutation(conn, user_id, mutation))
    return results


async def _apply_cart_mutation(
    conn: Connection, user_id: UUID, mutation: CartMutation
) -> SyncPushItemResult:
    existing = await cart_repository.get_by_client_id(conn, user_id, mutation.client_id)
    if mutation.op == "delete":
        return await _apply_cart_delete(conn, user_id, mutation, existing)
    return await _apply_cart_upsert(conn, user_id, mutation, existing)


async def _apply_cart_upsert(
    conn: Connection, user_id: UUID, mutation: CartMutation, existing: dict | None
) -> SyncPushItemResult:
    if existing is not None and existing["deleted_at"] is not None:
        return _ignored_stale(mutation.client_id, "carrinho já removido (tombstone é terminal)")

    incoming = mutation.fields.model_dump(exclude_none=True)

    if existing is None:
        row = await cart_repository.create(
            conn,
            user_id,
            mutation.client_id,
            incoming,
            {field: mutation.updated_at.isoformat() for field in incoming},
            mutation.updated_at,
        )
        await sync_change_repository.log_change(
            conn,
            user_id,
            "cart",
            mutation.client_id,
            "upsert",
            _snapshot(row, CART_SNAPSHOT_KEYS),
            row["updated_at"],
        )
        return _applied(mutation.client_id, row["updated_at"])

    winning_fields, winning_versions = merge_field_versions(
        existing["field_versions"], incoming, mutation.updated_at
    )
    if not winning_fields:
        return _ignored_stale(
            mutation.client_id, "todos os campos são mais antigos que a versão já gravada"
        )

    merged_versions = {**existing["field_versions"], **winning_versions}
    row_updated_at = latest_version(merged_versions, existing["updated_at"])
    row = await cart_repository.update(
        conn, existing["id"], winning_fields, winning_versions, row_updated_at
    )
    await sync_change_repository.log_change(
        conn,
        user_id,
        "cart",
        mutation.client_id,
        "upsert",
        _snapshot(row, CART_SNAPSHOT_KEYS),
        row["updated_at"],
    )
    return _applied(mutation.client_id, row["updated_at"])


async def _apply_cart_delete(
    conn: Connection, user_id: UUID, mutation: CartMutation, existing: dict | None
) -> SyncPushItemResult:
    if existing is None:
        return _rejected(mutation.client_id, "carrinho não encontrado para exclusão")
    if existing["deleted_at"] is not None:
        return _ignored_stale(mutation.client_id, "já removido")

    row = await cart_repository.soft_delete(
        conn, existing["id"], {"deleted_at": mutation.updated_at.isoformat()}, mutation.updated_at
    )
    await sync_change_repository.log_change(
        conn, user_id, "cart", mutation.client_id, "delete", {}, row["updated_at"]
    )
    return _applied(mutation.client_id, row["updated_at"])


async def _apply_cart_item_mutation(
    conn: Connection, user_id: UUID, mutation: CartItemMutation
) -> SyncPushItemResult:
    existing = await cart_item_repository.get_by_client_id(conn, user_id, mutation.client_id)
    if mutation.op == "delete":
        return await _apply_cart_item_delete(conn, user_id, mutation, existing)
    return await _apply_cart_item_upsert(conn, user_id, mutation, existing)


async def _apply_cart_item_upsert(
    conn: Connection, user_id: UUID, mutation: CartItemMutation, existing: dict | None
) -> SyncPushItemResult:
    if existing is not None and existing["deleted_at"] is not None:
        return _ignored_stale(mutation.client_id, "item já removido (tombstone é terminal)")

    incoming = mutation.fields.model_dump(exclude_none=True)

    if existing is None:
        missing = [field for field in CART_ITEM_REQUIRED_ON_CREATE if field not in incoming]
        if missing:
            return _rejected(
                mutation.client_id,
                f"campos obrigatórios ausentes na criação: {', '.join(missing)}",
            )

        cart_client_id = incoming.pop("cart_client_id")
        cart = await cart_repository.get_by_client_id(conn, user_id, cart_client_id)
        if cart is None or cart["deleted_at"] is not None:
            return _rejected(
                mutation.client_id,
                f"carrinho {cart_client_id} não encontrado — envie a mutação do "
                "carrinho antes da do item",
            )

        row = await cart_item_repository.create(
            conn,
            user_id,
            mutation.client_id,
            cart["id"],
            cart_client_id,
            incoming,
            {field: mutation.updated_at.isoformat() for field in incoming},
            mutation.updated_at,
        )
        await sync_change_repository.log_change(
            conn,
            user_id,
            "cart_item",
            mutation.client_id,
            "upsert",
            _snapshot(row, CART_ITEM_SNAPSHOT_KEYS),
            row["updated_at"],
        )
        return _applied(mutation.client_id, row["updated_at"])

    incoming.pop("cart_client_id", None)  # imutável após a criação — reenvio é ignorado
    winning_fields, winning_versions = merge_field_versions(
        existing["field_versions"], incoming, mutation.updated_at
    )
    if not winning_fields:
        return _ignored_stale(
            mutation.client_id, "todos os campos são mais antigos que a versão já gravada"
        )

    merged_versions = {**existing["field_versions"], **winning_versions}
    row_updated_at = latest_version(merged_versions, existing["updated_at"])
    row = await cart_item_repository.update(
        conn, existing["id"], winning_fields, winning_versions, row_updated_at
    )
    await sync_change_repository.log_change(
        conn,
        user_id,
        "cart_item",
        mutation.client_id,
        "upsert",
        _snapshot(row, CART_ITEM_SNAPSHOT_KEYS),
        row["updated_at"],
    )
    return _applied(mutation.client_id, row["updated_at"])


async def _apply_cart_item_delete(
    conn: Connection, user_id: UUID, mutation: CartItemMutation, existing: dict | None
) -> SyncPushItemResult:
    if existing is None:
        return _rejected(mutation.client_id, "item não encontrado para exclusão")
    if existing["deleted_at"] is not None:
        return _ignored_stale(mutation.client_id, "já removido")

    row = await cart_item_repository.soft_delete(
        conn, existing["id"], {"deleted_at": mutation.updated_at.isoformat()}, mutation.updated_at
    )
    await sync_change_repository.log_change(
        conn, user_id, "cart_item", mutation.client_id, "delete", {}, row["updated_at"]
    )
    return _applied(mutation.client_id, row["updated_at"])


def _applied(client_id: UUID, updated_at: dt.datetime) -> SyncPushItemResult:
    return SyncPushItemResult(client_id=client_id, status="applied", updated_at=updated_at)


def _ignored_stale(client_id: UUID, reason: str) -> SyncPushItemResult:
    return SyncPushItemResult(client_id=client_id, status="ignored_stale", reason=reason)


def _rejected(client_id: UUID, reason: str) -> SyncPushItemResult:
    return SyncPushItemResult(client_id=client_id, status="rejected", reason=reason)
