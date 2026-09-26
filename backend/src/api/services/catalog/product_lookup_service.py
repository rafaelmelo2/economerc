"""Postgres → Valkey → Open Food Facts, nessa ordem (Etapa 3 do roadmap).

Cache de "não encontrado" tem TTL menor que o de encontrado — um EAN inexistente no OFF é
consultado nesse ritmo até alguém corrigir/cadastrar manualmente; um EAN encontrado vira
produto local no Postgres na hora (fonte de verdade), então o cache Valkey do lado positivo só
evita corrida (duas requisições simultâneas) chamando o OFF duas vezes.
"""

from typing import Final

import orjson
from asyncpg import Connection
from valkey.asyncio import Valkey

from api.core.exceptions import NotFoundError
from api.repositories.catalog.product_repository import product_repository
from api.services.catalog.gtin import normalize_gtin
from api.services.catalog.open_food_facts_client import fetch_off_raw_product, map_off_product

CACHE_KEY_PREFIX: Final = "economerc:cache:catalog:off:"
CACHE_TTL_FOUND_SECONDS: Final = 3600
CACHE_TTL_MISS_SECONDS: Final = 600


def _cache_key(ean: str) -> str:
    return f"{CACHE_KEY_PREFIX}{ean}"


def _not_found(ean: str) -> NotFoundError:
    return NotFoundError(detail=f"Nenhum produto encontrado para o EAN {ean}.")


async def resolve_product_by_ean(conn: Connection, valkey: Valkey, ean_raw: str) -> dict:
    """Resolve um produto pelo EAN: local primeiro, depois cache, depois Open Food Facts.

    Levanta `InvalidGtinError` (400) se o EAN não bater no formato/dígito verificador, e
    `NotFoundError` (404) se não existir nem localmente nem no OFF.
    """
    ean = normalize_gtin(ean_raw)

    existing = await product_repository.get_by_ean(conn, ean)
    if existing is not None:
        return existing

    cached = await valkey.get(_cache_key(ean))
    if cached is not None:
        cached_payload = orjson.loads(cached)
        if not cached_payload["found"]:
            raise _not_found(ean)
        new_product = map_off_product(ean, cached_payload["raw"])
        return await product_repository.create(conn, new_product)

    off_raw_product = await fetch_off_raw_product(ean)
    if off_raw_product is None:
        await valkey.set(_cache_key(ean), orjson.dumps({"found": False}), ex=CACHE_TTL_MISS_SECONDS)
        raise _not_found(ean)

    await valkey.set(
        _cache_key(ean),
        orjson.dumps({"found": True, "raw": off_raw_product}),
        ex=CACHE_TTL_FOUND_SECONDS,
    )
    new_product = map_off_product(ean, off_raw_product)
    return await product_repository.create(conn, new_product)
