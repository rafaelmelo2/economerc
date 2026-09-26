import datetime as dt
from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends

from api.core.exceptions import NotFoundError
from api.dependencies.auth import CurrentUser
from api.repositories.catalog.product_repository import product_repository
from api.repositories.markets.market_repository import market_repository
from api.repositories.prices.price_repository import NewPriceObservation, price_repository
from api.schemas.prices.price import PriceCreateRequest, PriceObservationResponse, PriceResponse
from api.services.catalog.gtin import normalize_gtin
from api.services.prices.price_service import build_price_observation, resolve_confidence
from config.database import get_conn

router = APIRouter(prefix="/prices", tags=["Prices"])


@router.get("", response_model=list[PriceObservationResponse])
async def list_latest_prices(
    ean: str,
    city_id: UUID,
    user: CurrentUser,
    conn: Connection = Depends(get_conn),
) -> list[PriceObservationResponse]:
    """Último preço de cada mercado da cidade para o produto, com `is_stale` e preço/unidade."""
    normalized_ean = normalize_gtin(ean)
    product = await product_repository.get_by_ean(conn, normalized_ean)
    if product is None:
        raise NotFoundError(detail=f"Nenhum produto encontrado para o EAN {normalized_ean}.")
    rows = await price_repository.get_latest_by_market(conn, product["id"], city_id)
    return [build_price_observation(row, product) for row in rows]


@router.post("", response_model=PriceResponse, status_code=201)
async def create_price_observation(
    body: PriceCreateRequest, user: CurrentUser, conn: Connection = Depends(get_conn)
) -> PriceResponse:
    """Registra uma observação de preço (modo coletor + comunidade). Idempotente por `client_id`."""
    market = await market_repository.get_by_id(conn, body.market_id)
    if market is None:
        raise NotFoundError(detail="Mercado não encontrado.")
    price = await price_repository.create(
        conn,
        NewPriceObservation(
            product_id=body.product_id,
            market_id=body.market_id,
            city_id=market["city_id"],
            amount=body.amount,
            source=body.source,
            confidence=resolve_confidence(body.source),
            observed_at=body.observed_at or dt.datetime.now(dt.UTC),
            reported_by=user.user_id,
            client_id=body.client_id,
            promo_until=body.promo_until,
        ),
    )
    return PriceResponse(**price)
