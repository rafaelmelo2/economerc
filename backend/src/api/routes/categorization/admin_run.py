"""`POST /api/admin/categorization/run` — categoriza em lote produtos sem categoria
(docs/roadmap-fase1.md > Etapa 8). Concorrência controlada via anyio (skill
`anyio-concurrency`) no serviço; a rota só repassa a `conn` da request.
"""

from asyncpg import Connection
from fastapi import APIRouter, Depends
from valkey.asyncio import Valkey

from api.core.valkey_client import get_valkey
from api.dependencies.auth import AdminUser
from api.schemas.categorization.category import CategorizationRunRequest, CategorizationRunResponse
from api.services.categorization.categorization_batch_service import run_categorization_batch
from config.database import get_conn

router = APIRouter(prefix="/admin/categorization", tags=["Categorization"])


@router.post("/run", response_model=CategorizationRunResponse)
async def run_categorization(
    body: CategorizationRunRequest,
    user: AdminUser,
    conn: Connection = Depends(get_conn),
    valkey: Valkey = Depends(get_valkey),
) -> CategorizationRunResponse:
    result = await run_categorization_batch(conn, valkey, limit=body.limit)
    return CategorizationRunResponse(
        processed=result.processed, categorized=result.categorized, by_source=result.by_source
    )
