"""`GET /sync/pull?cursor=&limit=` — pull incremental por cursor opaco
(rules/mobile.md), inclui tombstones. Isolamento por usuário garantido no
próprio `WHERE user_id = $1` do repositório — nunca filtra só pelo `id`.
"""

from typing import Final

from asyncpg import Connection
from fastapi import APIRouter, Depends, Query

from api.dependencies.auth import CurrentUser
from api.repositories.sync.sync_change_repository import sync_change_repository
from api.schemas.sync.pull import SyncChangeResponse, SyncPullResponse
from api.services.sync.cursor import decode_cursor, encode_cursor
from config.database import get_conn

router = APIRouter(prefix="/sync", tags=["Sync"])

DEFAULT_PULL_LIMIT: Final = 200
MAX_PULL_LIMIT: Final = 500


@router.get("/pull", response_model=SyncPullResponse)
async def pull_sync_changes(
    user: CurrentUser,
    cursor: str | None = Query(None, max_length=64),
    limit: int = Query(DEFAULT_PULL_LIMIT, ge=1, le=MAX_PULL_LIMIT),
    conn: Connection = Depends(get_conn),
) -> SyncPullResponse:
    after_id = decode_cursor(cursor)
    rows = await sync_change_repository.list_since(conn, user.user_id, after_id, limit + 1)

    has_more = len(rows) > limit
    page = rows[:limit]
    changes = [
        SyncChangeResponse(
            entity=row["entity"],
            op=row["op"],
            client_id=row["entity_id"],
            updated_at=row["changed_at"],
            fields=row["payload"],
        )
        for row in page
    ]
    next_id = page[-1]["id"] if page else after_id
    return SyncPullResponse(changes=changes, has_more=has_more, next_cursor=encode_cursor(next_id))
