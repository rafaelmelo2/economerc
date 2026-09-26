"""Job de categorização em lote (`POST /api/admin/categorization/run`). NCM/regra são
DB reads baratos e rodam sequenciais na mesma `conn`; só a chamada de IA (rede, o
gargalo real) roda em fan-out concorrente via `anyio.CapacityLimiter` — nenhuma task
concorrente toca a conexão asyncpg (skill `anyio-concurrency`: conexão não é
thread/task-safe), as escritas voltam a ser sequenciais depois do fan-out.
"""

from dataclasses import dataclass
from typing import Final
from uuid import UUID

import anyio
from asyncpg import Connection
from valkey.asyncio import Valkey

from api.repositories.catalog.category_repository import category_repository
from api.repositories.catalog.product_repository import product_repository
from api.services.categorization.categorization_service import (
    CategorizationResult,
    ask_ai_for_category_slug,
    cache_ai_category,
    categorize_by_ncm,
    categorize_by_rule,
    get_cached_ai_category,
    resolve_category_by_slug,
)

DEFAULT_BATCH_LIMIT: Final = 100
MAX_BATCH_LIMIT: Final = 500
AI_CONCURRENCY: Final = 5


@dataclass(frozen=True, slots=True)
class CategorizationRunResult:
    processed: int
    categorized: int
    by_source: dict[str, int]


async def _resolve_ai_categories_concurrently(
    conn: Connection, valkey: Valkey, categories: list[dict], products: list[dict]
) -> dict[UUID, CategorizationResult]:
    """Fan-out concorrente SÓ da chamada de IA (pura rede); resolução final por
    slug volta a usar `conn` sequencial, depois que todas as respostas chegaram."""
    if not products:
        return {}

    results: dict[UUID, CategorizationResult] = {}
    ai_candidates: list[dict] = []
    for product in products:
        cached = (
            await get_cached_ai_category(valkey, product["ean"]) if product.get("ean") else None
        )
        if cached is not None:
            results[product["id"]] = cached
        else:
            ai_candidates.append(product)

    slugs_by_product: dict[UUID, str | None] = {}
    limiter = anyio.CapacityLimiter(AI_CONCURRENCY)

    async def _ask_one(product: dict) -> None:
        async with limiter:
            slugs_by_product[product["id"]] = await ask_ai_for_category_slug(
                categories, product["name"]
            )

    async with anyio.create_task_group() as tg:
        for product in ai_candidates:
            tg.start_soon(_ask_one, product)

    for product in ai_candidates:
        result = await resolve_category_by_slug(
            conn, categories, slugs_by_product.get(product["id"]), source="ai"
        )
        if result is None:
            continue
        results[product["id"]] = result
        if product.get("ean"):
            await cache_ai_category(valkey, product["ean"], result)

    return results


async def run_categorization_batch(
    conn: Connection, valkey: Valkey, *, limit: int
) -> CategorizationRunResult:
    products = await product_repository.list_uncategorized(conn, min(limit, MAX_BATCH_LIMIT))
    counts = {"ncm": 0, "rule": 0, "ai": 0}
    categorized = 0
    remaining: list[dict] = []

    for product in products:
        result = await categorize_by_ncm(conn, product.get("ncm")) or await categorize_by_rule(
            conn, product["name"]
        )
        if result is None:
            remaining.append(product)
            continue
        await product_repository.update_category(
            conn, product["id"], result.category_id, result.source
        )
        categorized += 1
        counts[result.source] += 1

    categories = await category_repository.list_all(conn)
    ai_results = await _resolve_ai_categories_concurrently(conn, valkey, categories, remaining)
    for product in remaining:
        result = ai_results.get(product["id"])
        if result is None:
            continue
        await product_repository.update_category(
            conn, product["id"], result.category_id, result.source
        )
        categorized += 1
        counts[result.source] += 1

    return CategorizationRunResult(
        processed=len(products), categorized=categorized, by_source=counts
    )
