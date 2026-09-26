"""Adaptador de NFC-e de Goiás (docs/nfce-sefaz-go.md) — primeira UF suportada.

Investigação real do portal (set/2026, `GO_NOTES.md` neste diretório): a página de
consulta resumida (`/nfeweb/sites/nfce/danfeNFCe?p=...`) responde em uma única
requisição, sem captcha — mesmo para uma chave inexistente ela tenta resolver e
devolve mensagem de erro amigável. A consulta completa (`/nfeweb/sites/nfe/
consulta-completa`), essa sim, exige Cloudflare Turnstile — por isso o adaptador
usa só a resumida (Plano A do risco "Captcha" da doc).

Sem nota real disponível ainda (dono do projeto vai trazer amostras de Catalão),
o parser cobre o layout padrão de DANFE NFC-e HTML (tabela de itens Código/
Descrição/Qtde/UN/Vl. Unit/Vl. Total + bloco do emitente com CNPJ) usando
fixtures sintéticas (`tests/fixtures/nfce/go/synthetic_*.html`) — reprocessável
quando as notas reais chegarem, já que o bruto fica salvo no banco.
"""

import datetime as dt
import html
import re
from decimal import Decimal, InvalidOperation
from typing import Final

from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
from curl_cffi.requests.exceptions import RequestException

from api.core.valkey_client import get_valkey
from api.services.nfce.adapters.base import (
    MarketDraft,
    ReceiptDraft,
    ReceiptItemDraft,
    redact_consumer_cpf,
)
from api.services.nfce.qr import rewrite_old_go_host

HTTP_TIMEOUT_SECONDS: Final = 15
BROWSER_IMPERSONATE: Final = "chrome"
REQUEST_HEADERS: Final = {"Accept-Language": "pt-BR,pt;q=0.9"}

# Rate limit por host (Valkey, skill `infra`) — não martelar o portal da SEFAZ;
# a fila (JetStream) absorve picos e reenvia depois via NAK com backoff.
RATE_LIMIT_KEY: Final = "ratelimit:nfce:go"
RATE_LIMIT_MAX_REQUESTS: Final = 20
RATE_LIMIT_WINDOW_SECONDS: Final = 60
CNPJ_LENGTH: Final = 14

_MONEY_PATTERN: Final = re.compile(r"-?\d{1,3}(?:\.\d{3})*(?:,\d{1,4})?|-?\d+(?:,\d{1,4})?")
_CNPJ_PATTERN: Final = re.compile(r"\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}")
_EMISSAO_PATTERN: Final = re.compile(r"(\d{2}/\d{2}/\d{4})\s+(\d{2}:\d{2}:\d{2})")

# A "casca" que `ShowDanfeNFCe` injeta sempre traz esse array JS, mesmo vazio (GO_NOTES.md >
# item 1 e 6, requisição real feita com chave fictícia de DV válido). Qualquer entrada em
# `ERROR` é o portal respondendo com sucesso (200, sem captcha) que NÃO resolveu a chave —
# nota inexistente/chave inválida, não falha de rede: tratamos como permanente, não retryable.
_PORTAL_MESSAGE_PATTERN: Final = re.compile(
    r"_message\s*=\s*\{.*?'ERROR'\s*:\s*\[(?P<errors>.*?)\]", re.DOTALL
)
_PORTAL_ERROR_ITEM_PATTERN: Final = re.compile(r"'((?:[^'\\]|\\.)*)'")

# Cabeçalhos esperados na tabela de itens do DANFE NFC-e resumido — a ordem varia
# por layout, então mapeamos por texto do `<th>` em vez de por posição fixa.
_HEADER_ALIASES: Final[dict[str, str]] = {
    "código": "market_code",
    "codigo": "market_code",
    "descrição": "raw_name",
    "descricao": "raw_name",
    "qtde": "quantity",
    "qtd": "quantity",
    "un": "unit",
    "vl. unit": "unit_price",
    "vl unit": "unit_price",
    "vl. total": "total_price",
    "vl total": "total_price",
    "ean": "ean",
    "ncm": "ncm",
}


class NfceRateLimitedError(Exception):
    """Rate limit local (Valkey) estourado — worker trata como retryable (NAK + backoff)."""


class NfceFetchError(Exception):
    """Falha ao consultar o portal da SEFAZ (rede, timeout, HTTP 4xx/5xx) — retryable."""


class NfceNotFoundError(Exception):
    """O portal respondeu (200, sem captcha) que a chave não existe/é inválida — falha
    PERMANENTE (GO_NOTES.md > item 6): não é rede fora do ar, é a SEFAZ dizendo "essa nota não
    está aqui". O worker marca `failed` na hora, sem gastar tentativa de retry."""


class NfceParseError(ValueError):
    """HTML da SEFAZ não bateu com o layout esperado do DANFE NFC-e."""


def _parse_brl_decimal(text: str) -> Decimal:
    """`"1.234,56"` -> `Decimal("1234.56")`; `"2,000"` -> `Decimal("2.000")`."""
    match = _MONEY_PATTERN.search(text)
    if match is None:
        raise NfceParseError(f"valor monetário/numérico não encontrado em {text!r}")
    cleaned = match.group(0).replace(".", "").replace(",", ".")
    try:
        return Decimal(cleaned)
    except InvalidOperation as exc:
        raise NfceParseError(f"valor numérico inválido: {text!r}") from exc


def _normalize_cnpj(text: str) -> str:
    digits = re.sub(r"\D", "", text)
    if len(digits) != CNPJ_LENGTH:
        raise NfceParseError(f"CNPJ do emitente inválido: {text!r}")
    return digits


def _header_key(th_text: str) -> str | None:
    return _HEADER_ALIASES.get(th_text.strip().lower())


def extract_portal_error(raw_html: str) -> str | None:
    """Lê o array `_message.ERROR` da casca `ShowDanfeNFCe` (GO_NOTES.md > item 1 e 6).

    Devolve a primeira mensagem (HTML entities decodificadas), ou `None` se a lista vier vazia
    (caso normal — nota resolvida, sem erro do portal)."""
    match = _PORTAL_MESSAGE_PATTERN.search(raw_html)
    if match is None:
        return None
    items = _PORTAL_ERROR_ITEM_PATTERN.findall(match.group("errors"))
    if not items:
        return None
    return html.unescape(items[0])


def _parse_market(soup: BeautifulSoup) -> MarketDraft:
    cnpj_el = soup.select_one(".cnpj") or soup.find(string=_CNPJ_PATTERN)
    if cnpj_el is None:
        raise NfceParseError("bloco do emitente sem CNPJ")
    cnpj_text = cnpj_el.get_text() if hasattr(cnpj_el, "get_text") else str(cnpj_el)
    cnpj_match = _CNPJ_PATTERN.search(cnpj_text)
    if cnpj_match is None:
        raise NfceParseError(f"CNPJ não encontrado em {cnpj_text!r}")
    trade_name_el = soup.select_one(".nome")
    trade_name = trade_name_el.get_text(strip=True) if trade_name_el else "Mercado não identificado"
    address_el = soup.select_one(".endereco")
    address = address_el.get_text(strip=True) if address_el else None
    return MarketDraft(
        cnpj=_normalize_cnpj(cnpj_match.group(0)),
        trade_name=trade_name,
        legal_name=trade_name,
        address=address,
    )


def _parse_items(soup: BeautifulSoup) -> list[ReceiptItemDraft]:
    table = soup.select_one("table.itens")
    if table is None:
        raise NfceParseError("tabela de itens não encontrada no HTML da nota")
    header_cells = table.select("thead th")
    columns = [_header_key(th.get_text()) for th in header_cells]
    if "raw_name" not in columns:
        raise NfceParseError("tabela de itens sem coluna de descrição")

    items: list[ReceiptItemDraft] = []
    for line_number, row in enumerate(table.select("tbody tr"), start=1):
        cells = row.find_all("td")
        values = dict(zip(columns, (c.get_text(strip=True) for c in cells), strict=False))
        raw_name = values.get("raw_name")
        if not raw_name:
            continue  # linha sem descrição (ex.: linha de total embutida) — pula, não quebra o parse.
        items.append(
            ReceiptItemDraft(
                line_number=line_number,
                raw_name=raw_name,
                market_code=values.get("market_code") or None,
                ean=values.get("ean") or None,
                ncm=values.get("ncm") or None,
                quantity=_parse_brl_decimal(values.get("quantity", "1")),
                unit=values.get("unit") or None,
                unit_price=_parse_brl_decimal(values.get("unit_price", "0")),
                total_price=_parse_brl_decimal(values.get("total_price", "0")),
            )
        )
    if not items:
        raise NfceParseError("nenhum item reconhecido na tabela da nota")
    return items


def _parse_issued_at(soup: BeautifulSoup) -> dt.datetime:
    emissao_el = soup.select_one(".emissao")
    text = emissao_el.get_text() if emissao_el else soup.get_text()
    match = _EMISSAO_PATTERN.search(text)
    if match is None:
        raise NfceParseError("data/hora de emissão não encontrada")
    date_part, time_part = match.groups()
    naive = dt.datetime.strptime(f"{date_part} {time_part}", "%d/%m/%Y %H:%M:%S")
    # NFC-e é emitida no fuso local (America/Sao_Paulo); armazenamos UTC (rules/backend.md).
    return naive.replace(tzinfo=dt.timezone(dt.timedelta(hours=-3))).astimezone(dt.UTC)


def _parse_totals(soup: BeautifulSoup) -> tuple[Decimal, Decimal | None]:
    total_el = soup.select_one(".valor-total")
    if total_el is None:
        raise NfceParseError("valor total da nota não encontrado")
    total_amount = _parse_brl_decimal(total_el.get_text())
    discount_el = soup.select_one(".valor-desconto")
    discount_amount = _parse_brl_decimal(discount_el.get_text()) if discount_el else None
    return total_amount, discount_amount


def parse_danfe_html(raw_html: str) -> ReceiptDraft:
    """Parser tolerante do DANFE NFC-e resumido — layout padrão (docs/nfce-sefaz-go.md).

    Levanta `NfceParseError` com o motivo específico quando um bloco esperado não
    é encontrado; o worker guarda essa mensagem em `receipts.failure_reason`.
    """
    soup = BeautifulSoup(raw_html, "html.parser")
    market = _parse_market(soup)
    items = _parse_items(soup)
    issued_at = _parse_issued_at(soup)
    total_amount, discount_amount = _parse_totals(soup)
    return ReceiptDraft(
        market=market,
        items=items,
        issued_at=issued_at,
        total_amount=total_amount,
        discount_amount=discount_amount,
    )


class GoNfceAdapter:
    """cUF 52 — Goiás. Único adaptador desta onda (registry.py roteia por UF)."""

    async def _check_rate_limit(self) -> None:
        client = get_valkey()
        count = await client.incr(RATE_LIMIT_KEY)
        if count == 1:
            await client.expire(RATE_LIMIT_KEY, RATE_LIMIT_WINDOW_SECONDS)
        if count > RATE_LIMIT_MAX_REQUESTS:
            raise NfceRateLimitedError(
                f"limite de {RATE_LIMIT_MAX_REQUESTS} consultas/{RATE_LIMIT_WINDOW_SECONDS}s "
                "ao portal da SEFAZ-GO atingido"
            )

    async def fetch(self, qr_url: str) -> str:
        """Busca o DANFE NFC-e resumido. CPF do consumidor é removido antes de retornar.

        A resolução da chave é síncrona nesta mesma requisição (GO_NOTES.md > item 1): se o
        portal respondeu com sucesso (200) mas sinalizou que não achou a nota, isso é permanente
        (`NfceNotFoundError`), não uma falha de rede — o worker não deve gastar retry nisso."""
        await self._check_rate_limit()
        url = rewrite_old_go_host(qr_url)
        try:
            async with AsyncSession(
                impersonate=BROWSER_IMPERSONATE, timeout=HTTP_TIMEOUT_SECONDS
            ) as session:
                response = await session.get(url, headers=REQUEST_HEADERS)
                response.raise_for_status()
        except RequestException as exc:
            raise NfceFetchError(f"falha ao consultar o portal da SEFAZ-GO: {exc}") from exc

        portal_error = extract_portal_error(response.text)
        if portal_error is not None:
            raise NfceNotFoundError(f"SEFAZ-GO: {portal_error}")
        return redact_consumer_cpf(response.text)

    def parse(self, raw_html: str) -> ReceiptDraft:
        return parse_danfe_html(raw_html)


go_adapter = GoNfceAdapter()
