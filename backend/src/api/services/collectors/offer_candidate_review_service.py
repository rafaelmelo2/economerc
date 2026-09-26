"""Aprovação/rejeição da fila de revisão (bloco 4C). Aprovar cria uma `prices` real
(`source='flyer'`); rejeitar só fecha o candidato. Nenhuma das duas mexe em `offer_candidates`
que já saiu de `pending` — a UPDATE condicional do repository barra a dupla revisão."""

from uuid import UUID

from asyncpg import Connection

from api.core.exceptions import BadRequestError, NotFoundError
from api.repositories.catalog.product_repository import product_repository
from api.repositories.collectors.offer_candidate_repository import offer_candidate_repository
from api.repositories.markets.market_repository import market_repository
from api.repositories.prices.price_repository import NewPriceObservation, price_repository
from api.services.prices.price_service import resolve_confidence

FLYER_SOURCE = "flyer"


async def _resolve_product_id(
    conn: Connection, candidate: dict, requested_product_id: UUID | None
) -> UUID:
    if requested_product_id is not None:
        return requested_product_id
    if candidate["ean"]:
        product = await product_repository.get_by_ean(conn, candidate["ean"])
        if product is not None:
            return product["id"]
    raise BadRequestError(
        detail="Não foi possível casar este candidato com um produto — informe `product_id`."
    )


async def approve_offer_candidate(
    conn: Connection, candidate_id: UUID, *, product_id: UUID | None, reviewed_by: UUID
) -> dict:
    candidate = await offer_candidate_repository.get_by_id(conn, candidate_id)
    if candidate is None:
        raise NotFoundError(detail="Candidato de oferta não encontrado.")
    if candidate["status"] != "pending":
        raise BadRequestError(detail="Este candidato já foi revisado.")

    resolved_product_id = await _resolve_product_id(conn, candidate, product_id)
    market = await market_repository.get_by_id(conn, candidate["market_id"])
    if market is None:
        raise NotFoundError(detail="Mercado do candidato não encontrado.")

    await price_repository.create(
        conn,
        NewPriceObservation(
            product_id=resolved_product_id,
            market_id=candidate["market_id"],
            city_id=market["city_id"],
            amount=candidate["price_amount"],
            source=FLYER_SOURCE,
            confidence=resolve_confidence(FLYER_SOURCE),
            observed_at=candidate["created_at"],
            promo_until=candidate["valid_until"],
        ),
    )

    updated = await offer_candidate_repository.mark_reviewed(
        conn, candidate_id, status="approved", reviewed_by=reviewed_by
    )
    if updated is None:  # corrida: outro admin aprovou entre o SELECT e o UPDATE
        raise BadRequestError(detail="Este candidato já foi revisado.")
    return updated


async def reject_offer_candidate(
    conn: Connection, candidate_id: UUID, *, reviewed_by: UUID
) -> dict:
    candidate = await offer_candidate_repository.get_by_id(conn, candidate_id)
    if candidate is None:
        raise NotFoundError(detail="Candidato de oferta não encontrado.")

    updated = await offer_candidate_repository.mark_reviewed(
        conn, candidate_id, status="rejected", reviewed_by=reviewed_by
    )
    if updated is None:
        raise BadRequestError(detail="Este candidato já foi revisado.")
    return updated
