"""Testes do parser do DANFE NFC-e resumido (fixtures sintéticas — sem nota real ainda,
docs/nfce-sefaz-go.md). Sem banco, sem rede."""

from decimal import Decimal
from pathlib import Path

import pytest

from api.services.nfce.adapters.base import redact_consumer_cpf
from api.services.nfce.adapters.go import NfceParseError, parse_danfe_html

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "nfce" / "go"


def _read_fixture(name: str) -> str:
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


def test_parse_danfe_html_extracts_market():
    draft = parse_danfe_html(_read_fixture("synthetic_valid.html"))
    assert draft.market.cnpj == "12345678000195"
    assert draft.market.trade_name == "SUPERMERCADO MODELO LTDA"


def test_parse_danfe_html_extracts_items_with_and_without_ean():
    draft = parse_danfe_html(_read_fixture("synthetic_valid.html"))
    assert len(draft.items) == 2

    rice, beans = draft.items
    assert rice.raw_name == "ARROZ TIPO 1 5KG"
    assert rice.ean == "7891234567895"
    assert rice.ncm == "10063000"
    assert rice.quantity == Decimal("2.000")
    assert rice.unit_price == Decimal("25.90")
    assert rice.total_price == Decimal("51.80")

    assert beans.raw_name == "FEIJAO CARIOCA 1KG"
    assert beans.ean is None
    assert beans.market_code == "0002"


def test_parse_danfe_html_extracts_totals_and_issued_at():
    draft = parse_danfe_html(_read_fixture("synthetic_valid.html"))
    assert draft.total_amount == Decimal("74.30")
    assert draft.discount_amount == Decimal("0.00")
    assert draft.issued_at.isoformat() == "2026-09-15T17:32:10+00:00"


def test_parse_danfe_html_never_leaks_cpf_into_the_draft():
    """O CPF aparece só no bruto (já redigido antes do parse, ver GoNfceAdapter.fetch);
    o parser em si não extrai CPF nenhum em `ReceiptDraft`/`MarketDraft`/`ReceiptItemDraft`."""
    draft = parse_danfe_html(_read_fixture("synthetic_valid.html"))
    dump = repr(draft)
    assert "123.456.789-00" not in dump


def test_parse_danfe_html_raises_with_clear_reason_when_items_table_is_missing():
    with pytest.raises(NfceParseError, match="tabela de itens"):
        parse_danfe_html(_read_fixture("synthetic_missing_items_table.html"))


def test_redact_consumer_cpf_removes_punctuated_cpf():
    html = "<div>CPF do consumidor: 123.456.789-00</div>"
    redacted = redact_consumer_cpf(html)
    assert "123.456.789-00" not in redacted
    assert "[CPF removido]" in redacted


def test_redact_consumer_cpf_removes_bare_digits_labeled_cpf():
    html = "<div>CPF: 12345678900</div>"
    redacted = redact_consumer_cpf(html)
    assert "12345678900" not in redacted


def test_redact_consumer_cpf_keeps_the_rest_of_the_document_intact():
    html = _read_fixture("synthetic_valid.html")
    redacted = redact_consumer_cpf(html)
    assert "SUPERMERCADO MODELO LTDA" in redacted
    assert "ARROZ TIPO 1 5KG" in redacted
    assert "123.456.789-00" not in redacted
