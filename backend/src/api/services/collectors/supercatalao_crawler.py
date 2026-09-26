"""Orquestra o crawler do Supermercado Catalão (bloco 4C): HTTP educado (curl_cffi, impersonate
chrome, `REQUEST_DELAY_SECONDS` entre chamadas) + persistência. A extração pura mora em
`supercatalao_parser.py` — este módulo só faz I/O (rede + banco).

Grava `prices` (source='scraper') **só** para aliases já ligados a um produto — alias sem
produto (a maioria, no cold start) fica pra casamento manual/RapidFuzz depois
(`product_matching_service.py`).
"""

import datetime as dt
from dataclasses import dataclass
from typing import Final
from uuid import UUID

import anyio
import structlog
from asyncpg import Connection
from curl_cffi.requests import AsyncSession

from api.repositories.catalog.product_alias_repository import (
    NewProductAlias,
    product_alias_repository,
)
from api.repositories.collectors.collector_run_repository import collector_run_repository
from api.repositories.collectors.market_source_repository import market_source_repository
from api.repositories.markets.market_repository import market_repository
from api.repositories.prices.price_repository import NewPriceObservation, price_repository
from api.services.collectors.product_matching_service import suggest_product_match
from api.services.collectors.supercatalao_parser import (
    DepartmentPageResult,
    ScrapedProductItem,
    extract_department_slugs,
    parse_department_page,
)
from api.services.prices.price_service import resolve_confidence

log = structlog.get_logger(__name__)

STORE_BASE_URL: Final = "https://www.supercatalaoonline.com.br/loja"
MARKET_TRADE_NAME: Final = "Supermercado Catalão"
COLLECTOR_NAME: Final = "supercatalao"
REQUEST_DELAY_SECONDS: Final = 1.5
SCRAPER_SOURCE: Final = "scraper"


@dataclass(frozen=True, slots=True)
class CrawlOutcome:
    items_found: int
    aliases_created: int
    prices_created: int


async def _fetch_page(session: AsyncSession, url: str) -> str:
    response = await session.get(url, impersonate="chrome", timeout=20)
    response.raise_for_status()
    return response.text


async def _fetch_all_department_pages(
    session: AsyncSession, department_slug: str, *, max_pages: int
) -> list[DepartmentPageResult]:
    """Pagina `?page=N` até `totalPages` ou `max_pages` — o que vier primeiro (rate limit)."""
    results: list[DepartmentPageResult] = []
    page = 1
    while page <= max_pages:
        url = f"{STORE_BASE_URL}/{department_slug}"
        if page > 1:
            url = f"{url}?page={page}"
        html = await _fetch_page(session, url)
        result = parse_department_page(html)
        results.append(result)
        if result.pagination is None or page >= result.pagination.total_pages:
            break
        page += 1
        await anyio.sleep(REQUEST_DELAY_SECONDS)
    return results


async def _upsert_alias_and_price(
    conn: Connection,
    *,
    market_id: UUID,
    city_id: UUID,
    item: ScrapedProductItem,
    observed_at: dt.datetime,
) -> tuple[bool, bool]:
    """Devolve `(alias_criado, preco_criado)`."""
    existing_alias = await product_alias_repository.get_by_market_code(
        conn, market_id, item.market_code
    )
    if existing_alias is not None:
        alias = existing_alias
        alias_created = False
    else:
        suggestion = await suggest_product_match(conn, item.raw_name)
        auto_linked_product_id = (
            suggestion.product_id if suggestion is not None and suggestion.is_auto_link else None
        )
        alias = await product_alias_repository.create(
            conn,
            NewProductAlias(
                market_id=market_id,
                raw_name=item.raw_name,
                market_code=item.market_code,
                product_id=auto_linked_product_id,
            ),
        )
        if suggestion is not None and auto_linked_product_id is None:
            await product_alias_repository.set_suggested_match(
                conn, alias["id"], suggestion.product_id, suggestion.score
            )
        alias_created = True

    if alias["product_id"] is None:
        return alias_created, False

    await price_repository.create(
        conn,
        NewPriceObservation(
            product_id=alias["product_id"],
            market_id=market_id,
            city_id=city_id,
            amount=item.amount,
            source=SCRAPER_SOURCE,
            confidence=resolve_confidence(SCRAPER_SOURCE),
            observed_at=observed_at,
            promo_until=item.promo_until,
        ),
    )
    return alias_created, True


async def run_supercatalao_crawl(
    conn: Connection, *, max_pages_per_department: int = 3
) -> CrawlOutcome:
    """Fluxo completo: home → departamentos → paginação → persistência.

    `max_pages_per_department` limita a paginação por departamento (educado com o site real;
    o admin/CLI pode pedir mais, o default cobre bem o catálogo sem martelar o servidor).
    """
    market_source = await market_source_repository.get_active_site_by_market_name(
        conn, MARKET_TRADE_NAME
    )
    if market_source is None:
        raise RuntimeError(
            f"nenhuma market_source 'site' ativa para '{MARKET_TRADE_NAME}' — rode a migration "
            "de seed (20260926090001_create_market_sources.sql) ou cadastre uma."
        )
    market = await market_repository.get_by_id(conn, market_source["market_id"])
    if market is None:
        raise RuntimeError(f"market_source aponta pra um mercado inexistente: {market_source}")

    observed_at = dt.datetime.now(dt.UTC)
    items_found = 0
    aliases_created = 0
    prices_created = 0

    async with AsyncSession() as session:
        home_html = await _fetch_page(session, STORE_BASE_URL)
        department_slugs = extract_department_slugs(home_html)
        log.info("supercatalao_departments_discovered", count=len(department_slugs))

        home_result = parse_department_page(home_html)
        all_items = list(home_result.items)

        for slug in department_slugs:
            await anyio.sleep(REQUEST_DELAY_SECONDS)
            pages = await _fetch_all_department_pages(
                session, slug, max_pages=max_pages_per_department
            )
            for page_result in pages:
                all_items.extend(page_result.items)

    seen_market_codes: set[str] = set()
    for item in all_items:
        if item.market_code in seen_market_codes:
            continue
        seen_market_codes.add(item.market_code)
        items_found += 1
        created_alias, created_price = await _upsert_alias_and_price(
            conn,
            market_id=market["id"],
            city_id=market["city_id"],
            item=item,
            observed_at=observed_at,
        )
        aliases_created += int(created_alias)
        prices_created += int(created_price)

    return CrawlOutcome(
        items_found=items_found, aliases_created=aliases_created, prices_created=prices_created
    )


async def run_supercatalao_collector(
    conn: Connection, *, max_pages_per_department: int = 3
) -> dict:
    """Envelope de observabilidade: abre/fecha um `collector_runs`, marca sucesso/erro na fonte.
    Usado pelo endpoint admin e pelo worker CLI (`python -m api.workers.collect_supercatalao`).
    """
    market_source = await market_source_repository.get_active_site_by_market_name(
        conn, MARKET_TRADE_NAME
    )
    market_source_id = market_source["id"] if market_source else None
    run = await collector_run_repository.start(conn, COLLECTOR_NAME, market_source_id)

    try:
        outcome = await run_supercatalao_crawl(
            conn, max_pages_per_department=max_pages_per_department
        )
    except Exception as exc:
        log.exception("supercatalao_crawl_failed")
        if market_source_id is not None:
            await market_source_repository.mark_error(conn, market_source_id, str(exc))
        return await collector_run_repository.finish(
            conn,
            run["id"],
            status="failed",
            items_found=0,
            aliases_created=0,
            prices_created=0,
            error_message=str(exc)[:500],
        )

    if market_source_id is not None:
        await market_source_repository.mark_success(conn, market_source_id)
    log.info(
        "supercatalao_crawl_completed",
        items_found=outcome.items_found,
        aliases_created=outcome.aliases_created,
        prices_created=outcome.prices_created,
    )
    return await collector_run_repository.finish(
        conn,
        run["id"],
        status="success",
        items_found=outcome.items_found,
        aliases_created=outcome.aliases_created,
        prices_created=outcome.prices_created,
    )
