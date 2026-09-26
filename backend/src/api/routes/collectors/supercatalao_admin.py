from asyncpg import Connection
from fastapi import APIRouter, Depends, Query

from api.dependencies.auth import AdminUser
from api.schemas.collectors.collector_run import CollectorRunResponse
from api.services.collectors.supercatalao_crawler import run_supercatalao_collector
from config.database import get_conn

router = APIRouter(prefix="/admin/collectors", tags=["Admin", "Collectors"])

DEFAULT_MAX_PAGES_PER_DEPARTMENT = 3
MAX_PAGES_PER_DEPARTMENT_LIMIT = 20


@router.post("/supercatalao/run", response_model=CollectorRunResponse, status_code=201)
async def run_supercatalao_collector_route(
    user: AdminUser,
    max_pages: int = Query(
        DEFAULT_MAX_PAGES_PER_DEPARTMENT, ge=1, le=MAX_PAGES_PER_DEPARTMENT_LIMIT
    ),
    conn: Connection = Depends(get_conn),
) -> CollectorRunResponse:
    """Dispara o crawler na hora (síncrono) — uso manual do admin, fora do cron do worker CLI."""
    run = await run_supercatalao_collector(conn, max_pages_per_department=max_pages)
    return CollectorRunResponse(**run)
