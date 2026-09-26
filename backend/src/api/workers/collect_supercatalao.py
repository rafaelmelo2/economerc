"""CLI do crawler do Supermercado Catalão (bloco 4C).

Uso: `cd backend && uv run python -m api.workers.collect_supercatalao [--max-pages N]`

Roda uma vez e sai (cron/systemd timer chama isso periodicamente — sem loop interno, sem
scheduler embutido; agendamento é infra, não código).
"""

import argparse

import anyio

from api.core.logging import get_logger, setup_logging
from api.services.collectors.supercatalao_crawler import run_supercatalao_collector
from config.database import close_asyncpg_pool, get_pool, init_asyncpg_pool

setup_logging()
log = get_logger(__name__)

DEFAULT_MAX_PAGES_PER_DEPARTMENT = 3


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawler do Supermercado Catalão")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=DEFAULT_MAX_PAGES_PER_DEPARTMENT,
        help="Páginas por departamento (educado com o site real; default=3)",
    )
    return parser.parse_args()


async def main() -> None:
    args = _parse_args()
    await init_asyncpg_pool()
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            run = await run_supercatalao_collector(conn, max_pages_per_department=args.max_pages)
        log.info(
            "supercatalao_worker_finished",
            status=run["status"],
            items_found=run["items_found"],
            aliases_created=run["aliases_created"],
            prices_created=run["prices_created"],
        )
    finally:
        await close_asyncpg_pool()


if __name__ == "__main__":
    anyio.run(main)
