"""Admin: fila de notas com falha (bloco 5B). `POST /{id}/retry` republica em

`receipts.ingest` — o reprocessamento em si é o MESMO worker (`workers/receipts_worker.py`),
nunca lógica duplicada aqui."""

from typing import Literal
from uuid import UUID

import orjson
from asyncpg import Connection
from fastapi import APIRouter, Depends, Query

from api.core.exceptions import BadRequestError, NotFoundError
from api.core.nats_client import nats_client
from api.dependencies.auth import AdminUser
from api.models.shared.paged_response import PagedResponse
from api.repositories.markets.market_repository import market_repository
from api.repositories.receipts.receipt_repository import receipt_repository
from api.repositories.users.user_repository import user_repository
from api.routes.shared.list_params import ListParamsDep
from api.schemas.receipts.admin_receipt import AdminReceiptResponse
from api.services.nfce.streams import RECEIPTS_INGEST_SUBJECT, ensure_receipts_stream
from config.database import get_conn

router = APIRouter(prefix="/admin/receipts", tags=["Admin", "Receipts"])

RETRY_REASON: str = "Reprocessamento manual pelo admin"


@router.get("", response_model=PagedResponse[AdminReceiptResponse])
async def list_admin_receipts(
    user: AdminUser,
    params: ListParamsDep,
    status: Literal["pending", "processing", "done", "failed", "duplicate"] | None = Query(None),
    conn: Connection = Depends(get_conn),
) -> PagedResponse[AdminReceiptResponse]:
    page = await receipt_repository.list_for_admin(conn, params, status=status)
    return PagedResponse(
        items=page.items,
        total=page.total,
        skip=params.skip,
        limit=params.limit,
        has_more=page.has_more,
    )


@router.post("/{receipt_id}/retry", response_model=AdminReceiptResponse)
async def retry_admin_receipt(
    receipt_id: UUID, user: AdminUser, conn: Connection = Depends(get_conn)
) -> AdminReceiptResponse:
    receipt = await receipt_repository.get_by_id(conn, receipt_id)
    if receipt is None:
        raise NotFoundError(detail="Nota não encontrada.")
    if receipt["status"] != "failed":
        raise BadRequestError(
            detail=f"Só é possível reprocessar notas com status 'failed' (atual: {receipt['status']!r})."
        )

    updated = await receipt_repository.reset_to_pending(conn, receipt_id, RETRY_REASON)
    if updated is None:
        raise NotFoundError(detail="Nota não encontrada.")

    js = nats_client.get_jetstream()
    await ensure_receipts_stream(js)
    await js.publish(RECEIPTS_INGEST_SUBJECT, orjson.dumps({"receipt_id": str(receipt_id)}))

    reporter = await user_repository.get_by_id(conn, updated["user_id"])
    market = (
        await market_repository.get_by_id(conn, updated["market_id"])
        if updated["market_id"]
        else None
    )
    return AdminReceiptResponse(
        **updated,
        user_email=reporter["email"] if reporter else None,
        market_name=market["trade_name"] if market else None,
    )
