"""`POST /sync/push` — outbox do app (rules/mobile.md). Lote inteiro numa
única transação (skill `database`): commit só se todas as gravações da
função de serviço rodarem sem erro; o status por item já reflete regras de
negócio (`ignored_stale`/`rejected`), não é um retry parcial.
"""

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.dependencies.auth import CurrentUser
from api.schemas.sync.push import SyncPushRequest, SyncPushResponse
from api.services.sync.sync_service import apply_push_batch
from config.database import get_conn

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.post("/push", response_model=SyncPushResponse)
async def push_sync_batch(
    payload: SyncPushRequest,
    user: CurrentUser,
    conn: Connection = Depends(get_conn),
) -> SyncPushResponse:
    async with conn.transaction():
        results = await apply_push_batch(conn, user.user_id, payload.mutations)
    return SyncPushResponse(results=results)
