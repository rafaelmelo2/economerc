"""Regras de negócio de `prices`: confiança default por fonte e sinalização de desatualizado."""

import datetime as dt
from decimal import Decimal
from typing import Final

from api.schemas.prices.price import PriceObservationResponse
from api.services.prices.unit_price_service import compute_unit_price

STALE_AFTER_DAYS: Final = 15

# Confiança inicial por fonte (docs/modelagem.md) — sobe depois com votos/reputação (Fase 2).
# `scraper` (crawler direto do site do mercado, sem EAN, casado por `product_aliases`) fica
# entre `flyer` e `community`: preço de vitrine é confiável, mas o casamento produto↔item é
# só por nome até alguém confirmar escaneando ou lendo uma nota desse mercado.
DEFAULT_CONFIDENCE_BY_SOURCE: Final[dict[str, Decimal]] = {
    "nfce": Decimal("0.95"),
    "partner": Decimal("0.90"),
    "flyer": Decimal("0.80"),
    "scraper": Decimal("0.70"),
    "community": Decimal("0.60"),
    "manual": Decimal("0.40"),
}


def resolve_confidence(source: str) -> Decimal:
    return DEFAULT_CONFIDENCE_BY_SOURCE[source]


def is_price_stale(observed_at: dt.datetime, *, now: dt.datetime | None = None) -> bool:
    """> 15 dias sem confirmação = desatualizado (requisito de escopo, `docs/produto.md`)."""
    reference = now or dt.datetime.now(dt.UTC)
    return observed_at < reference - dt.timedelta(days=STALE_AFTER_DAYS)


def build_price_observation(row: dict, product: dict) -> PriceObservationResponse:
    """Monta a resposta de `GET /prices`: preço por unidade + sinalização de desatualizado."""
    unit_price = compute_unit_price(row["amount"], product["unit"], product["net_quantity"])
    unit_label, unit_amount = unit_price if unit_price else (None, None)
    return PriceObservationResponse(
        id=row["id"],
        product_id=row["product_id"],
        market_id=row["market_id"],
        market_name=row["market_name"],
        city_id=row["city_id"],
        amount=row["amount"],
        unit_amount=unit_amount,
        unit_label=unit_label,
        source=row["source"],
        confidence=row["confidence"],
        observed_at=row["observed_at"],
        promo_until=row["promo_until"],
        is_stale=is_price_stale(row["observed_at"]),
    )
