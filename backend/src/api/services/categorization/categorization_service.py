"""Categorização de produto (docs/roadmap-fase1.md > Etapa 8): NCM → dicionário de
termos → IA, nessa ordem — IA só roda quando as duas regras baratas não acham nada.
Resultado da IA cacheado por EAN (Valkey) — nunca chama a tarefa `categorize_product`
duas vezes pro mesmo EAN. Quando encontra, grava em `products` (`category_id` +
`category_source`); correção manual (`category_source='user'`, rota dedicada) tem
prioridade e nunca é sobrescrita por este serviço.
"""

from dataclasses import dataclass
from typing import Final
from uuid import UUID

import orjson
import structlog
from asyncpg import Connection
from pydantic import BaseModel, Field, ValidationError
from valkey.asyncio import Valkey

from api.repositories.catalog.category_repository import category_repository
from api.repositories.catalog.product_repository import product_repository
from api.services.ai import ai_client
from api.services.ai.ai_client import AiProviderError, AiTaskNotConfiguredError
from api.services.categorization.term_dictionary import match_category_slug_by_term

log = structlog.get_logger(__name__)

CACHE_KEY_PREFIX: Final = "cache:categorization:ai:ean:"
CACHE_TTL_SECONDS: Final = 30 * 24 * 3600  # 30 dias — dicionário/IA raramente mudam de ideia

CATEGORIZE_PRODUCT_SYSTEM_PROMPT_TEMPLATE: Final = (
    "Você categoriza produtos de supermercado brasileiro. Escolha SOMENTE uma categoria da "
    "lista abaixo pelo `slug` exato — nunca invente uma categoria nova. Lista (slug: nome): "
    "{categories}\n"
    'Responda só com JSON estrito: {{"category_slug": "<slug da lista>"}}'
)


class _CategorizeProductAiResponse(BaseModel):
    category_slug: str = Field(min_length=1)


@dataclass(frozen=True, slots=True)
class CategorizationResult:
    category_id: UUID
    category_slug: str
    source: str  # ncm | rule | ai


def _cache_key(ean: str) -> str:
    return f"{CACHE_KEY_PREFIX}{ean}"


async def categorize_by_ncm(conn: Connection, ncm: str | None) -> CategorizationResult | None:
    if not ncm:
        return None
    category = await category_repository.find_by_ncm(conn, ncm)
    if category is None:
        return None
    return CategorizationResult(category["id"], category["slug"], "ncm")


async def categorize_by_rule(conn: Connection, name: str) -> CategorizationResult | None:
    slug = match_category_slug_by_term(name)
    if slug is None:
        return None
    category = await category_repository.get_by_slug(conn, slug)
    if category is None:
        return None
    return CategorizationResult(category["id"], category["slug"], "rule")


def _build_categories_prompt(categories: list[dict]) -> str:
    return ", ".join(f"{c['slug']}: {c['name']}" for c in categories)


async def ask_ai_for_category_slug(categories: list[dict], product_name: str) -> str | None:
    """Chamada pura de IA (sem DB) — usada tanto no fluxo single-item quanto no fan-out
    concorrente do job em lote (`categorization_batch_service`)."""
    system_prompt = CATEGORIZE_PRODUCT_SYSTEM_PROMPT_TEMPLATE.format(
        categories=_build_categories_prompt(categories)
    )
    try:
        completion = await ai_client.complete(
            "categorize_product",
            system_prompt=system_prompt,
            user_text=product_name,
            json_output=True,
        )
    except (AiProviderError, AiTaskNotConfiguredError):
        log.warning("categorize_product_ai_call_failed", product_name=product_name)
        return None

    try:
        parsed = _CategorizeProductAiResponse.model_validate(orjson.loads(completion.content))
    except (orjson.JSONDecodeError, ValidationError):
        log.warning("categorize_product_ai_invalid_response", content=completion.content[:200])
        return None
    return parsed.category_slug


async def resolve_category_by_slug(
    conn: Connection, categories: list[dict], slug: str | None, *, source: str
) -> CategorizationResult | None:
    """Confere que o slug devolvido pela IA é um dos existentes antes de resolver —
    a IA nunca escolhe categoria fora da lista enviada no prompt."""
    if slug is None or slug not in {c["slug"] for c in categories}:
        return None
    category = await category_repository.get_by_slug(conn, slug)
    if category is None:
        return None
    return CategorizationResult(category["id"], category["slug"], source)


async def get_cached_ai_category(valkey: Valkey, ean: str) -> CategorizationResult | None:
    cached = await valkey.get(_cache_key(ean))
    if cached is None:
        return None
    payload = orjson.loads(cached)
    return CategorizationResult(UUID(payload["category_id"]), payload["category_slug"], "ai")


async def cache_ai_category(valkey: Valkey, ean: str, result: CategorizationResult) -> None:
    await valkey.set(
        _cache_key(ean),
        orjson.dumps(
            {"category_id": str(result.category_id), "category_slug": result.category_slug}
        ),
        ex=CACHE_TTL_SECONDS,
    )


async def _categorize_via_cache_or_ai(
    conn: Connection, valkey: Valkey, ean: str | None, name: str
) -> CategorizationResult | None:
    if ean:
        cached = await get_cached_ai_category(valkey, ean)
        if cached is not None:
            return cached

    categories = await category_repository.list_all(conn)
    slug = await ask_ai_for_category_slug(categories, name)
    result = await resolve_category_by_slug(conn, categories, slug, source="ai")

    if result is not None and ean:
        await cache_ai_category(valkey, ean, result)
    return result


async def categorize_product(
    conn: Connection,
    valkey: Valkey,
    *,
    product_id: UUID,
    ean: str | None,
    name: str,
    ncm: str | None,
) -> CategorizationResult | None:
    """NCM → termo → IA. Quando encontra, GRAVA em `products`; senão devolve `None`
    (produto fica sem categoria, elegível pro job em lote depois)."""
    result = await categorize_by_ncm(conn, ncm) or await categorize_by_rule(conn, name)
    if result is None:
        result = await _categorize_via_cache_or_ai(conn, valkey, ean, name)

    if result is not None:
        await product_repository.update_category(
            conn, product_id, result.category_id, result.source
        )
    return result
