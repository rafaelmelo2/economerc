"""Cliente Open Food Facts (skill `http-client`, curl_cffi) — fonte `off` do catálogo."""

import re
from decimal import Decimal
from typing import Final

import structlog
from curl_cffi.requests import AsyncSession

from api.core.exceptions import BadGatewayError
from api.repositories.catalog.product_repository import NewProduct

log = structlog.get_logger(__name__)

OFF_BASE_URL: Final = "https://world.openfoodfacts.org/api/v2/product"
OFF_TIMEOUT_SECONDS: Final = 5.0
OFF_USER_AGENT: Final = (
    "EconoMerc/1.0 (app brasileiro de compras de mercado; contato: contato@economerc.app.br)"
)
OFF_FOUND_STATUS: Final = 1
OFF_NOT_FOUND_STATUS: Final = 404

_QUANTITY_RE: Final = re.compile(r"([\d.,]+)\s*(kg|g|l|ml)\b", re.IGNORECASE)
_DEFAULT_UNIT: Final = "un"


async def fetch_off_raw_product(ean: str) -> dict | None:
    """Consulta o Open Food Facts pelo EAN normalizado. `None` = produto não encontrado.

    Levanta `BadGatewayError` (502, pt-BR) em falha de rede/timeout — nunca silenciosa.
    """
    url = f"{OFF_BASE_URL}/{ean}.json"
    try:
        async with AsyncSession(impersonate="chrome", timeout=OFF_TIMEOUT_SECONDS) as session:
            response = await session.get(url, headers={"User-Agent": OFF_USER_AGENT})
    except Exception as exc:
        log.warning("off_lookup_network_error", ean=ean, error=str(exc))
        raise BadGatewayError() from exc
    if response.status_code == OFF_NOT_FOUND_STATUS:
        return None
    response.raise_for_status()
    payload = response.json()
    if payload.get("status") != OFF_FOUND_STATUS:
        return None
    return payload.get("product") or {}


def _parse_quantity(raw: str | None) -> tuple[str, Decimal | None]:
    """`quantity` do OFF é texto livre ('500 g', '1 L', '6x330ml'...) — extração best-effort."""
    if not raw:
        return _DEFAULT_UNIT, None
    match = _QUANTITY_RE.search(raw)
    if not match:
        return _DEFAULT_UNIT, None
    value = Decimal(match.group(1).replace(",", "."))
    return match.group(2).lower(), value


def map_off_product(ean: str, off_product: dict) -> NewProduct:
    """Traduz o payload do OFF pro shape de `NewProduct` — pura, sem I/O (testável sem mock)."""
    name = off_product.get("product_name_pt") or off_product.get("product_name") or f"Produto {ean}"
    brand_raw = (off_product.get("brands") or "").split(",")[0].strip()
    unit, net_quantity = _parse_quantity(off_product.get("quantity"))
    return NewProduct(
        ean=ean,
        name=name[:200],
        brand=brand_raw[:120] or None,
        category_id=None,
        unit=unit,
        net_quantity=net_quantity,
        image_upload_id=None,
        source="off",
    )
