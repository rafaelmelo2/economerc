"""Contrato comum dos adaptadores de NFC-e por UF (docs/nfce-sefaz-go.md > Arquitetura).

Cada UF implementa `fetch` (busca a página pública, bruto sem tratar) e `parse`
(função pura: HTML/XML bruto -> `ReceiptDraft`). O worker (`workers/receipts_worker.py`)
só conhece este `Protocol` — trocar de UF/adaptador não toca o worker.
"""

import datetime as dt
import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol, runtime_checkable

# CPF: 3+3+3+2 dígitos com pontuação, ou 11 dígitos corridos rotulados "CPF" — a NFC-e do
# consumidor final pode trazer o CPF do comprador no rodapé. LGPD: nunca persistir em claro.
_CPF_PUNCTUATED: re.Pattern[str] = re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}")
_CPF_LABELED_DIGITS: re.Pattern[str] = re.compile(r"(CPF[^0-9]{0,10})\d{11}\b", re.IGNORECASE)
CPF_REDACTED_PLACEHOLDER = "[CPF removido]"


def redact_consumer_cpf(html: str) -> str:
    """Remove CPF do consumidor do HTML bruto antes de qualquer persistência (LGPD)."""
    scrubbed = _CPF_PUNCTUATED.sub(CPF_REDACTED_PLACEHOLDER, html)
    return _CPF_LABELED_DIGITS.sub(rf"\1{CPF_REDACTED_PLACEHOLDER}", scrubbed)


@dataclass(frozen=True, slots=True)
class MarketDraft:
    cnpj: str
    trade_name: str
    legal_name: str | None = None
    address: str | None = None


@dataclass(frozen=True, slots=True)
class ReceiptItemDraft:
    line_number: int
    raw_name: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    market_code: str | None = None
    ean: str | None = None
    ncm: str | None = None
    unit: str | None = None


@dataclass(frozen=True, slots=True)
class ReceiptDraft:
    market: MarketDraft
    items: list[ReceiptItemDraft]
    issued_at: dt.datetime
    total_amount: Decimal
    discount_amount: Decimal | None = None


@runtime_checkable
class NfceAdapter(Protocol):
    async def fetch(self, qr_url: str) -> str:
        """Busca a página pública de consulta e devolve o HTML bruto (CPF já removido)."""
        ...

    def parse(self, raw_html: str) -> ReceiptDraft:
        """Função pura: HTML bruto -> dados estruturados da nota."""
        ...
