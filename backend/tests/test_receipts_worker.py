"""Worker de ingestão de NFC-e ponta a ponta — chama `process_receipt` direto (sem NATS,
rules/tests.md), com um adaptador fake que devolve a fixture sintética em vez de bater na
rede. Banco real (dbmate); HTTP da SEFAZ nunca é chamado nestes testes."""

from dataclasses import dataclass
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from asyncpg import Connection

from api.repositories.geo.city_repository import city_repository
from api.repositories.receipts.receipt_repository import NewReceipt, receipt_repository
from api.services.nfce.adapters.go import NfceFetchError, NfceNotFoundError, parse_danfe_html
from api.workers import receipts_worker
from api.workers.receipts_worker import MAX_ATTEMPTS, ReceiptProcessingOutcome, process_receipt
from tests.sync_helpers import create_test_user

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "nfce" / "go"
VALID_GO_KEY = "52250911222333000181650010001234561123456786"
CATALAO_IBGE_CODE = 5205109


def _read_fixture(name: str) -> str:
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


@dataclass
class _FakeGoAdapter:
    html: str | None = None
    error: Exception | None = None

    async def fetch(self, qr_url: str) -> str:
        if self.error is not None:
            raise self.error
        assert self.html is not None
        return self.html

    def parse(self, raw_html: str):
        return parse_danfe_html(raw_html)


async def _create_user_with_city(conn: Connection) -> UUID:
    user_id = await create_test_user(conn)
    city = await city_repository.get_by_ibge_code(conn, CATALAO_IBGE_CODE)
    assert city is not None
    await conn.execute(
        "INSERT INTO user_preferences (user_id, city_id) VALUES ($1, $2)", user_id, city["id"]
    )
    return user_id


async def _create_pending_receipt(
    conn: Connection, user_id: UUID, access_key: str = VALID_GO_KEY
) -> UUID:
    receipt = await receipt_repository.create(
        conn,
        NewReceipt(
            user_id=user_id,
            client_id=uuid4(),
            access_key=access_key,
            state_code="GO",
            qr_url="https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=x",
            status="pending",
        ),
    )
    return receipt["id"]


async def test_process_receipt_done_end_to_end_creates_market_items_and_prices(
    db_conn: Connection, monkeypatch
):
    user_id = await _create_user_with_city(db_conn)
    receipt_id = await _create_pending_receipt(db_conn, user_id)
    adapter = _FakeGoAdapter(html=_read_fixture("synthetic_valid.html"))
    monkeypatch.setattr(receipts_worker, "get_adapter", lambda state_code: adapter)

    outcome = await process_receipt(db_conn, receipt_id)

    assert outcome == ReceiptProcessingOutcome.DONE
    receipt = await db_conn.fetchrow("SELECT * FROM receipts WHERE id = $1", receipt_id)
    assert receipt["status"] == "done"
    assert receipt["market_id"] is not None
    assert str(receipt["total_amount"]) == "74.30"
    assert receipt["raw_html"] is not None

    market = await db_conn.fetchrow("SELECT * FROM markets WHERE id = $1", receipt["market_id"])
    assert market["cnpj"] == "12345678000195"
    assert market["trade_name"] == "SUPERMERCADO MODELO LTDA"

    items = await db_conn.fetch(
        "SELECT * FROM receipt_items WHERE receipt_id = $1 ORDER BY line_number", receipt_id
    )
    assert len(items) == 2
    rice, beans = items
    assert rice["ean"] == "7891234567895"
    assert rice["product_id"] is not None
    assert beans["ean"] is None
    assert beans["market_code"] == "0002"

    product = await db_conn.fetchrow("SELECT * FROM products WHERE id = $1", rice["product_id"])
    assert product["ean"] == "7891234567895"
    assert product["source"] == "nfce"

    prices = await db_conn.fetch(
        "SELECT * FROM prices WHERE product_id = $1 AND market_id = $2",
        rice["product_id"],
        market["id"],
    )
    assert len(prices) == 1
    assert prices[0]["source"] == "nfce"
    assert str(prices[0]["amount"]) == "25.90"

    # Item sem EAN casado só por alias (código do mercado) — sem produto ainda, sem preço.
    alias = await db_conn.fetchrow(
        "SELECT * FROM product_aliases WHERE market_id = $1 AND market_code = $2",
        market["id"],
        "0002",
    )
    assert alias is not None
    assert alias["product_id"] is None

    events = await db_conn.fetch(
        "SELECT to_status FROM receipt_events WHERE receipt_id = $1 ORDER BY created_at", receipt_id
    )
    assert [e["to_status"] for e in events] == ["processing", "done"]


async def test_process_receipt_is_idempotent_once_done(db_conn: Connection, monkeypatch):
    user_id = await _create_user_with_city(db_conn)
    receipt_id = await _create_pending_receipt(db_conn, user_id)
    adapter = _FakeGoAdapter(html=_read_fixture("synthetic_valid.html"))
    monkeypatch.setattr(receipts_worker, "get_adapter", lambda state_code: adapter)

    first = await process_receipt(db_conn, receipt_id)
    second = await process_receipt(db_conn, receipt_id)

    assert first == ReceiptProcessingOutcome.DONE
    assert second == ReceiptProcessingOutcome.SKIPPED
    items = await db_conn.fetch("SELECT * FROM receipt_items WHERE receipt_id = $1", receipt_id)
    assert len(items) == 2  # não duplicou ao reprocessar


async def test_process_receipt_reuses_market_without_overwriting_curated_fields(
    db_conn: Connection, monkeypatch
):
    user_id = await _create_user_with_city(db_conn)
    receipt_id = await _create_pending_receipt(db_conn, user_id)
    adapter = _FakeGoAdapter(html=_read_fixture("synthetic_valid.html"))
    monkeypatch.setattr(receipts_worker, "get_adapter", lambda state_code: adapter)

    city = await city_repository.get_by_ibge_code(db_conn, CATALAO_IBGE_CODE)
    curated_market = await db_conn.fetchrow(
        """
        INSERT INTO markets (city_id, cnpj, legal_name, trade_name, is_partner)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
        """,
        city["id"],
        "12345678000195",
        "Nome Curado Pelo Admin Ltda",
        "Apelido Curado",
    )

    outcome = await process_receipt(db_conn, receipt_id)

    assert outcome == ReceiptProcessingOutcome.DONE
    market = await db_conn.fetchrow("SELECT * FROM markets WHERE id = $1", curated_market["id"])
    assert market["legal_name"] == "Nome Curado Pelo Admin Ltda"
    assert market["trade_name"] == "Apelido Curado"
    assert market["is_partner"] is True


async def test_process_receipt_marks_failed_when_uf_has_no_adapter(
    db_conn: Connection, monkeypatch
):
    user_id = await _create_user_with_city(db_conn)
    receipt_id = await _create_pending_receipt(db_conn, user_id)
    monkeypatch.setattr(receipts_worker, "get_adapter", lambda state_code: None)

    outcome = await process_receipt(db_conn, receipt_id)

    assert outcome == ReceiptProcessingOutcome.FAILED
    receipt = await db_conn.fetchrow("SELECT * FROM receipts WHERE id = $1", receipt_id)
    assert receipt["status"] == "failed"
    assert receipt["failure_reason"] == "UF ainda não suportada"


async def test_process_receipt_retries_then_dead_letters_after_max_attempts(
    db_conn: Connection, monkeypatch
):
    user_id = await _create_user_with_city(db_conn)
    receipt_id = await _create_pending_receipt(db_conn, user_id)
    adapter = _FakeGoAdapter(error=NfceFetchError("timeout simulado"))
    monkeypatch.setattr(receipts_worker, "get_adapter", lambda state_code: adapter)

    for attempt in range(1, MAX_ATTEMPTS):
        outcome = await process_receipt(db_conn, receipt_id)
        assert outcome == ReceiptProcessingOutcome.RETRY
        receipt = await db_conn.fetchrow("SELECT * FROM receipts WHERE id = $1", receipt_id)
        assert receipt["status"] == "pending"
        assert receipt["attempts"] == attempt

    final_outcome = await process_receipt(db_conn, receipt_id)
    assert final_outcome == ReceiptProcessingOutcome.FAILED
    receipt = await db_conn.fetchrow("SELECT * FROM receipts WHERE id = $1", receipt_id)
    assert receipt["status"] == "failed"
    assert receipt["attempts"] == MAX_ATTEMPTS
    assert "timeout simulado" in receipt["failure_reason"]


async def test_process_receipt_marks_failed_immediately_when_note_not_found_in_sefaz(
    db_conn: Connection, monkeypatch
):
    """`NfceNotFoundError` (portal respondeu, sem captcha, dizendo que não achou a nota —
    GO_NOTES.md > item 6) é falha PERMANENTE: `failed` na primeira tentativa, sem consumir o
    orçamento de `MAX_ATTEMPTS` que existe só para falha transitória (rede/timeout/5xx)."""
    user_id = await _create_user_with_city(db_conn)
    receipt_id = await _create_pending_receipt(db_conn, user_id)
    adapter = _FakeGoAdapter(
        error=NfceNotFoundError("SEFAZ-GO: Não foi possível encontrar o XML da nota")
    )
    monkeypatch.setattr(receipts_worker, "get_adapter", lambda state_code: adapter)

    outcome = await process_receipt(db_conn, receipt_id)

    assert outcome == ReceiptProcessingOutcome.FAILED
    receipt = await db_conn.fetchrow("SELECT * FROM receipts WHERE id = $1", receipt_id)
    assert receipt["status"] == "failed"
    assert receipt["attempts"] == 1  # nem chegou perto de MAX_ATTEMPTS
    assert "Não foi possível encontrar o XML da nota" in receipt["failure_reason"]

    events = await db_conn.fetch(
        "SELECT to_status FROM receipt_events WHERE receipt_id = $1 ORDER BY created_at", receipt_id
    )
    assert [e["to_status"] for e in events] == ["processing", "failed"]


async def test_process_receipt_fails_when_user_has_no_city_for_a_brand_new_market(
    db_conn: Connection, monkeypatch
):
    user_id = await create_test_user(db_conn)  # sem user_preferences -> sem cidade
    receipt_id = await _create_pending_receipt(db_conn, user_id)
    adapter = _FakeGoAdapter(html=_read_fixture("synthetic_valid.html"))
    monkeypatch.setattr(receipts_worker, "get_adapter", lambda state_code: adapter)

    outcome = await process_receipt(db_conn, receipt_id)

    assert outcome == ReceiptProcessingOutcome.RETRY
    receipt = await db_conn.fetchrow("SELECT * FROM receipts WHERE id = $1", receipt_id)
    assert receipt["status"] == "pending"
    assert "cidade" in receipt["failure_reason"]


@pytest.mark.parametrize("html_fixture", ["synthetic_missing_items_table.html"])
async def test_process_receipt_retries_on_unexpected_layout(
    db_conn: Connection, monkeypatch, html_fixture
):
    user_id = await _create_user_with_city(db_conn)
    receipt_id = await _create_pending_receipt(db_conn, user_id)
    adapter = _FakeGoAdapter(html=_read_fixture(html_fixture))
    monkeypatch.setattr(receipts_worker, "get_adapter", lambda state_code: adapter)

    outcome = await process_receipt(db_conn, receipt_id)

    assert outcome == ReceiptProcessingOutcome.RETRY
    receipt = await db_conn.fetchrow("SELECT * FROM receipts WHERE id = $1", receipt_id)
    assert receipt["status"] == "pending"
    assert "tabela de itens" in receipt["failure_reason"]
