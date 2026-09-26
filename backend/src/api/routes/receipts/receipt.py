"""`POST /receipts` só valida o QR e enfileira — todo o trabalho pesado (buscar a página da
SEFAZ, casar produto, gravar preço) é do worker (`workers/receipts_worker.py`), NUNCA do
request (docs/nfce-sefaz-go.md > Arquitetura)."""

from uuid import UUID

import orjson
from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.core.exceptions import BadRequestError, NotFoundError
from api.core.nats_client import nats_client
from api.dependencies.auth import CurrentUser
from api.models.shared.paged_response import PagedResponse
from api.repositories.geo.state_repository import state_repository
from api.repositories.receipts.receipt_event_repository import receipt_event_repository
from api.repositories.receipts.receipt_item_repository import receipt_item_repository
from api.repositories.receipts.receipt_repository import NewReceipt, receipt_repository
from api.routes.shared.list_params import ListParamsDep
from api.schemas.receipts.receipt import (
    ReceiptCreateRequest,
    ReceiptDetailResponse,
    ReceiptItemResponse,
    ReceiptResponse,
)
from api.services.nfce.qr import parse_qr
from api.services.nfce.streams import RECEIPTS_INGEST_SUBJECT, ensure_receipts_stream
from config.database import get_conn

router = APIRouter(prefix="/receipts", tags=["Receipts"])


@router.post("", response_model=ReceiptResponse, status_code=202)
async def create_receipt(
    body: ReceiptCreateRequest, user: CurrentUser, conn: Connection = Depends(get_conn)
) -> ReceiptResponse:
    """Cria/reusa por chave de acesso e publica `receipts.ingest`. Idempotente por `client_id`
    (retry de rede do app) e por `access_key` (a mesma nota, enviada por outro usuário, vira
    uma linha própria com `status='duplicate'` — conta pro histórico dele, não reprocessa)."""
    replay = await receipt_repository.get_by_client_id(conn, user.user_id, body.client_id)
    if replay is not None:
        return ReceiptResponse(**replay)

    qr_payload = parse_qr(body.qr_text)  # levanta InvalidNfceQrError (400) em QR inválido
    access_key = qr_payload.access_key
    state_code = access_key.state_code
    if state_code is None:
        raise BadRequestError(
            detail=f"Código de UF (cUF={access_key.ibge_uf_code!r}) não reconhecido."
        )
    state = await state_repository.get_by_code(conn, state_code)
    if state is None:
        raise BadRequestError(detail=f"UF {state_code} ainda não cadastrada no sistema.")
    qr_url = qr_payload.qr_url or body.qr_text

    new_receipt = NewReceipt(
        user_id=user.user_id,
        client_id=body.client_id,
        access_key=access_key.raw,
        state_code=state_code,
        qr_url=qr_url,
        status="pending",
        cart_id=body.cart_id,
    )

    canonical = await receipt_repository.get_active_by_access_key(conn, access_key.raw)
    if canonical is not None:
        # Nota repetida (outro usuário já enviou a mesma chave) — histórico próprio, sem
        # reprocessar. NOTA: se o canônico ainda estiver pending/processing, esta linha
        # nasce com market_id/issued_at/total ainda vazios e não é atualizada depois — o
        # dado completo só vive na linha canônica (aceitável nesta fase: raro na prática,
        # já que o worker processa em segundos).
        duplicate = await receipt_repository.mark_duplicate(conn, new_receipt, canonical)
        await receipt_event_repository.append(
            conn,
            duplicate["id"],
            from_status=None,
            to_status="duplicate",
            detail=f"chave já processada na nota {canonical['id']}",
        )
        return ReceiptResponse(**duplicate)

    created = await receipt_repository.create(conn, new_receipt)
    await receipt_event_repository.append(
        conn, created["id"], from_status=None, to_status="pending"
    )

    js = nats_client.get_jetstream()
    await ensure_receipts_stream(js)
    await js.publish(RECEIPTS_INGEST_SUBJECT, orjson.dumps({"receipt_id": str(created["id"])}))

    return ReceiptResponse(**created)


@router.get("", response_model=PagedResponse[ReceiptResponse])
async def list_receipts(
    user: CurrentUser, params: ListParamsDep, conn: Connection = Depends(get_conn)
) -> PagedResponse[ReceiptResponse]:
    page = await receipt_repository.list_for_user(conn, user.user_id, params)
    return PagedResponse(
        items=page.items,
        total=page.total,
        skip=params.skip,
        limit=params.limit,
        has_more=page.has_more,
    )


@router.get("/{receipt_id}", response_model=ReceiptDetailResponse)
async def get_receipt(
    receipt_id: UUID, user: CurrentUser, conn: Connection = Depends(get_conn)
) -> ReceiptDetailResponse:
    receipt = await receipt_repository.get_by_id_for_user(conn, receipt_id, user.user_id)
    if receipt is None:
        raise NotFoundError(detail="Nota não encontrada.")
    items = await receipt_item_repository.list_by_receipt(conn, receipt_id)
    return ReceiptDetailResponse(**receipt, items=[ReceiptItemResponse(**item) for item in items])
