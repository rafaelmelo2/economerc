"""Camada de conexão Postgres.

- DSN única fonte de verdade: `DATABASE_URL` (`.env` no host, override do compose no docker).
- Pool kwargs (asyncpg) vêm de `settings.postgres.pool` (yaml).
- Schema gerenciado por dbmate (`backend/db/migrations/`) — nunca criado no startup.
- Codec orjson instalado em toda conexão para json/jsonb rápido (skill `database`).
"""

import os
from collections.abc import AsyncGenerator

import asyncpg
import orjson

from config.settings import settings

if "DATABASE_URL" not in os.environ:
    raise RuntimeError(
        "DATABASE_URL não setada. Defina em `.env` (host) ou via compose override "
        "(docker). Formato: postgres://user:pass@host:port/db?sslmode=disable"
    )

DATABASE_URL: str = os.environ["DATABASE_URL"]

asyncpg_pool: asyncpg.Pool | None = None


async def init_connection(conn: asyncpg.Connection) -> None:
    """Registra o codec orjson para json/jsonb em cada conexão do pool."""
    for type_name in ("json", "jsonb"):
        await conn.set_type_codec(
            type_name,
            schema="pg_catalog",
            encoder=lambda v: orjson.dumps(v).decode("utf-8"),
            decoder=orjson.loads,
            format="text",
        )


async def init_asyncpg_pool() -> None:
    global asyncpg_pool
    if asyncpg_pool is not None:
        return
    pool_cfg = settings.postgres.pool
    asyncpg_pool = await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=pool_cfg.min_size,
        max_size=pool_cfg.max_size,
        max_queries=pool_cfg.max_queries,
        max_inactive_connection_lifetime=pool_cfg.max_inactive_connection_lifetime,
        timeout=pool_cfg.timeout,
        command_timeout=pool_cfg.command_timeout,
        init=init_connection,
    )


async def close_asyncpg_pool() -> None:
    global asyncpg_pool
    if asyncpg_pool is not None:
        await asyncpg_pool.close()
        asyncpg_pool = None


async def get_pool() -> asyncpg.Pool:
    """Devolve o pool. Use para fan-out onde cada task pega sua própria conn."""
    if asyncpg_pool is None:
        await init_asyncpg_pool()
    return asyncpg_pool


async def get_conn() -> AsyncGenerator[asyncpg.Connection]:
    """Dependency FastAPI: uma conexão do pool por request."""
    if asyncpg_pool is None:
        await init_asyncpg_pool()
    async with asyncpg_pool.acquire() as connection:
        yield connection
