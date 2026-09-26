import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.core.exceptions import register_exception_handlers
from api.core.logging import get_logger, setup_logging, shutdown_logging
from api.core.nats_client import nats_client
from api.core.serializers import CustomORJSONResponse
from api.core.valkey_client import close_valkey, init_valkey
from api.middlewares.logging_middleware import LoggingMiddleware
from api.routes.centralizer import api_router
from config.api import api_config
from config.database import close_asyncpg_pool, get_pool, init_asyncpg_pool
from config.settings import settings

setup_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("startup_begin")

    try:
        await init_asyncpg_pool()
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        log.info("db_pool_ready")
    except Exception:
        log.exception("db_pool_init_failed")

    try:
        await init_valkey()
        log.info("valkey_ready")
    except Exception:
        log.exception("valkey_init_failed")

    try:
        await nats_client.connect()
        log.info("nats_ready")
    except Exception:
        log.exception("nats_unavailable")

    yield

    await nats_client.close()
    await close_valkey()
    await close_asyncpg_pool()
    log.info("shutdown_complete")
    shutdown_logging()


def _docs_enabled() -> bool:
    return os.getenv("ENVIRONMENT", "local") != "prod"


_DOCS_ENABLED = _docs_enabled()

app = FastAPI(
    title=api_config.PROJECT_NAME,
    version=api_config.PROJECT_VERSION,
    lifespan=lifespan,
    docs_url=f"{api_config.API_PREFIX}/docs" if _DOCS_ENABLED else None,
    redoc_url=f"{api_config.API_PREFIX}/redoc" if _DOCS_ENABLED else None,
    openapi_url=f"{api_config.API_PREFIX}/openapi.json" if _DOCS_ENABLED else None,
    default_response_class=CustomORJSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors.allow_origins,
    allow_credentials=settings.cors.allow_credentials,
    allow_methods=settings.cors.allow_methods,
    allow_headers=settings.cors.allow_headers,
    expose_headers=settings.cors.expose_headers,
    max_age=settings.cors.max_age,
)
app.add_middleware(LoggingMiddleware)

register_exception_handlers(app)

app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=api_config.HOST, port=api_config.PORT)
