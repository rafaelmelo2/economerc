"""Worker do WhatsApp (bloco 4C): mensagem ingerida -> `offer_candidates` pendentes.

IA sempre mockada (`extract_offers_via_ai` monkeypatchado) — nunca chama o OpenRouter de
verdade neste arquivo."""

from decimal import Decimal
from uuid import uuid4

import pytest
from asyncpg import Connection

from api.repositories.collectors.market_source_repository import (
    NewMarketSource,
    market_source_repository,
)
from api.repositories.geo.city_repository import city_repository
from api.repositories.markets.market_repository import NewMarket, market_repository
from api.services.collectors import whatsapp_offer_service
from api.services.collectors.flyer_ai_extractor import FlyerExtractItem
from api.services.collectors.whatsapp_offer_service import process_ingested_offer_message

CATALAO_IBGE_CODE = 5205109


async def _seed_market_and_source(conn: Connection) -> tuple[str, str]:
    city = await city_repository.get_by_ibge_code(conn, CATALAO_IBGE_CODE)
    market = await market_repository.create(
        conn, NewMarket(city_id=city["id"], trade_name="Mercado do Zé (teste worker)")
    )
    source = await market_source_repository.create(
        conn,
        NewMarketSource(
            market_id=market["id"], kind="whatsapp_group", identifier="120363000000001111@g.us"
        ),
    )
    return str(market["id"]), str(source["id"])


def _base_message(*, market_id: str, market_source_id: str, **overrides) -> dict:
    message = {
        "market_source_id": market_source_id,
        "market_id": market_id,
        "source_kind": "whatsapp_group",
        "message_id": "MSG1",
        "sender_push_name": "Mercado do Zé",
        "message_type": "conversation",
        "text": None,
        "image_base64": None,
        "message_timestamp": 1735689600,
    }
    message.update(overrides)
    return message


async def _fail_if_ai_called(**kwargs):  # pragma: no cover - não deve rodar
    raise AssertionError("IA não deveria ser chamada quando o regex já resolveu a linha")


async def test_regex_match_creates_candidate_without_calling_ai(
    db_conn: Connection, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(whatsapp_offer_service, "extract_offers_via_ai", _fail_if_ai_called)
    market_id, market_source_id = await _seed_market_and_source(db_conn)
    message = _base_message(
        market_id=market_id, market_source_id=market_source_id, text="Arroz Tio João 5kg R$ 24,99"
    )

    candidates = await process_ingested_offer_message(db_conn, message)

    assert len(candidates) == 1
    assert candidates[0]["price_amount"] == Decimal("24.99")
    assert "Arroz" in candidates[0]["product_name"]
    assert candidates[0]["status"] == "pending"
    assert candidates[0]["source"] == "whatsapp_group"


async def test_multiple_offer_lines_create_multiple_candidates(db_conn: Connection):
    market_id, market_source_id = await _seed_market_and_source(db_conn)
    text = "Arroz Tio João 5kg R$ 24,99\nPicanha bovina R$ 49,90/kg"
    message = _base_message(market_id=market_id, market_source_id=market_source_id, text=text)

    candidates = await process_ingested_offer_message(db_conn, message)

    assert len(candidates) == 2
    amounts = {c["price_amount"] for c in candidates}
    assert amounts == {Decimal("24.99"), Decimal("49.90")}


async def test_text_without_regex_match_falls_back_to_ai(
    db_conn: Connection, monkeypatch: pytest.MonkeyPatch
):
    async def _fake_ai(**kwargs):
        assert kwargs["text"] == "Confira as novidades da semana no encarte"
        return [FlyerExtractItem(product_name="Leite Itambé 1L", price_amount=Decimal("5.49"))]

    monkeypatch.setattr(whatsapp_offer_service, "extract_offers_via_ai", _fake_ai)
    market_id, market_source_id = await _seed_market_and_source(db_conn)
    message = _base_message(
        market_id=market_id,
        market_source_id=market_source_id,
        text="Confira as novidades da semana no encarte",
    )

    candidates = await process_ingested_offer_message(db_conn, message)

    assert len(candidates) == 1
    assert candidates[0]["product_name"] == "Leite Itambé 1L"
    assert candidates[0]["price_amount"] == Decimal("5.49")


async def test_image_message_always_goes_through_ai(
    db_conn: Connection, monkeypatch: pytest.MonkeyPatch
):
    calls = []

    async def _fake_ai(*, text, image_base64):
        calls.append((text, image_base64))
        return [
            FlyerExtractItem(
                product_name="Sabão em pó 1kg", price_amount=Decimal("12.90"), unit="un"
            )
        ]

    monkeypatch.setattr(whatsapp_offer_service, "extract_offers_via_ai", _fake_ai)
    market_id, market_source_id = await _seed_market_and_source(db_conn)
    message = _base_message(
        market_id=market_id,
        market_source_id=market_source_id,
        text="Encarte dessa semana",
        image_base64="ZmFrZS1pbWFnZQ==",
    )

    candidates = await process_ingested_offer_message(db_conn, message)

    assert len(calls) == 1
    assert calls[0] == ("Encarte dessa semana", "ZmFrZS1pbWFnZQ==")
    assert len(candidates) == 1
    assert candidates[0]["unit"] == "un"


async def test_ai_returning_no_items_creates_no_candidates(
    db_conn: Connection, monkeypatch: pytest.MonkeyPatch
):
    async def _fake_ai(**kwargs):
        return []

    monkeypatch.setattr(whatsapp_offer_service, "extract_offers_via_ai", _fake_ai)
    message = _base_message(
        market_id=str(uuid4()),
        market_source_id=str(uuid4()),
        text="Bom dia a todos, mercado aberto até as 20h",
    )

    candidates = await process_ingested_offer_message(db_conn, message)

    assert candidates == []


async def test_message_without_text_or_image_creates_no_candidates(db_conn: Connection):
    message = _base_message(
        market_id=str(uuid4()), market_source_id=str(uuid4()), text=None, image_base64=None
    )

    candidates = await process_ingested_offer_message(db_conn, message)

    assert candidates == []
