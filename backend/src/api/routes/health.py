import datetime as dt

from asyncpg import Connection
from fastapi import APIRouter, Depends, status

from api.core.nats_client import nats_client
from api.core.valkey_client import get_valkey, is_valkey_ready
from api.schemas.shared.common import DependencyStatus, HealthResponse
from config.api import api_config
from config.database import get_conn

router = APIRouter(tags=["Health"])


async def _check_database(conn: Connection) -> str:
    try:
        await conn.fetchval("SELECT 1")
        return "ok"
    except Exception:
        return "down"


async def _check_valkey() -> str:
    if not is_valkey_ready():
        return "down"
    try:
        await get_valkey().ping()
        return "ok"
    except Exception:
        return "down"


def _check_nats() -> str:
    return "ok" if nats_client.is_connected else "down"


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Status da API e das dependências (Postgres, Valkey, NATS).",
)
async def health_check(conn: Connection = Depends(get_conn)) -> HealthResponse:
    dependencies = DependencyStatus(
        database=await _check_database(conn),
        valkey=await _check_valkey(),
        nats=_check_nats(),
    )
    all_ok = all(v == "ok" for v in dependencies.model_dump().values())
    return HealthResponse(
        status="healthy" if all_ok else "degraded",
        version=api_config.PROJECT_VERSION,
        timestamp=dt.datetime.now(dt.UTC).isoformat(),
        dependencies=dependencies,
    )
