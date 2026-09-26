"""`GET /reports/*` (bloco 5B) — histórico do usuário. Cobre a regra anti-dupla-contagem

documentada em `api.repositories.reports.report_repository`: carrinho fechado e nota processada
do MESMO mercado no MESMO dia (fuso America/Sao_Paulo) contam como UMA compra só (a nota vence).
"""

import datetime as dt
import uuid
from decimal import Decimal

from asyncpg import Connection
from httpx import AsyncClient

from api.core.security import issue_access_token
from api.repositories.catalog.category_repository import category_repository
from api.repositories.catalog.product_repository import NewProduct, product_repository
from api.repositories.geo.city_repository import city_repository
from api.repositories.markets.market_repository import NewMarket, market_repository

CATALAO_IBGE_CODE = 5205109
SAO_PAULO_OFFSET = "-03:00"


async def _auth_headers(conn: Connection) -> tuple[dict[str, str], uuid.UUID]:
    user_id = uuid.uuid4()
    await conn.execute("INSERT INTO users (id, role) VALUES ($1, 'user')", user_id)
    token = issue_access_token(user_id, "user")
    return {"Authorization": f"Bearer {token}"}, user_id


async def _market(conn: Connection, name: str):
    city = await city_repository.get_by_ibge_code(conn, CATALAO_IBGE_CODE)
    return await market_repository.create(conn, NewMarket(city_id=city["id"], trade_name=name))


async def _product(conn: Connection, name: str, *, category_slug: str | None, ean: str):
    category = await category_repository.get_by_slug(conn, category_slug) if category_slug else None
    return await product_repository.create(
        conn,
        NewProduct(
            ean=ean,
            name=name,
            category_id=category["id"] if category else None,
        ),
    )


def _local_noon(day: str) -> dt.datetime:
    """`day` = "YYYY-MM-DD" às 12h em America/Sao_Paulo (UTC-3, sem DST na Fase 1)."""
    return dt.datetime.fromisoformat(f"{day}T12:00:00{SAO_PAULO_OFFSET}")


async def _closed_cart(
    conn: Connection, user_id: uuid.UUID, market_id: uuid.UUID, closed_at: dt.datetime
):
    return await conn.fetchval(
        """
        INSERT INTO carts (user_id, client_id, market_id, status, started_at, closed_at)
        VALUES ($1, $2, $3, 'closed', $4, $4)
        RETURNING id
        """,
        user_id,
        uuid.uuid4(),
        market_id,
        closed_at,
    )


async def _cart_item(
    conn: Connection,
    cart_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    product_id: uuid.UUID | None,
    name: str,
    unit_price: Decimal,
    quantity: Decimal = Decimal("1"),
):
    await conn.execute(
        """
        INSERT INTO cart_items (cart_id, cart_client_id, user_id, client_id, product_id,
                                 product_name, unit_price, quantity)
        VALUES ($1, gen_random_uuid(), $2, gen_random_uuid(), $3, $4, $5, $6)
        """,
        cart_id,
        user_id,
        product_id,
        name,
        unit_price,
        quantity,
    )


async def _done_receipt(
    conn: Connection,
    user_id: uuid.UUID,
    market_id: uuid.UUID,
    issued_at: dt.datetime,
    total_amount: Decimal,
):
    return await conn.fetchval(
        """
        INSERT INTO receipts (user_id, client_id, access_key, state_code, qr_url, status,
                               market_id, issued_at, total_amount)
        VALUES ($1, $2, $3, 'GO', 'https://nfce.example/qr', 'done', $4, $5, $6)
        RETURNING id
        """,
        user_id,
        uuid.uuid4(),
        str(uuid.uuid4().int)[:44].ljust(44, "0"),
        market_id,
        issued_at,
        total_amount,
    )


async def _receipt_item(
    conn: Connection,
    receipt_id: uuid.UUID,
    line_number: int,
    *,
    product_id: uuid.UUID | None,
    name: str,
    unit_price: Decimal,
    total_price: Decimal,
):
    await conn.execute(
        """
        INSERT INTO receipt_items (receipt_id, line_number, raw_name, quantity, unit_price,
                                    total_price, product_id)
        VALUES ($1, $2, $3, 1, $4, $5, $6)
        """,
        receipt_id,
        line_number,
        name,
        unit_price,
        total_price,
        product_id,
    )


async def test_monthly_report_prefers_receipt_over_same_day_same_market_cart(
    client: AsyncClient, db_conn: Connection
):
    headers, user_id = await _auth_headers(db_conn)
    market_x = await _market(db_conn, "Mercado X")
    market_y = await _market(db_conn, "Mercado Y")
    market_z = await _market(db_conn, "Mercado Z")
    hortifruti = await _product(db_conn, "Banana", category_slug="hortifruti", ean="7890000000001")
    laticinios = await _product(db_conn, "Leite", category_slug="laticinios", ean="7890000000002")
    sem_categoria = await _product(
        db_conn, "Item genérico", category_slug=None, ean="7890000000003"
    )

    # Carrinho + nota do MESMO mercado no MESMO dia — a nota vence, o carrinho some da soma.
    day_1 = _local_noon("2026-03-10")
    superseded_cart = await _closed_cart(db_conn, user_id, market_x["id"], day_1)
    await _cart_item(
        db_conn,
        superseded_cart,
        user_id,
        product_id=hortifruti["id"],
        name="Banana",
        unit_price=Decimal("40.00"),
    )
    receipt_a = await _done_receipt(db_conn, user_id, market_x["id"], day_1, Decimal("42.50"))
    await _receipt_item(
        db_conn,
        receipt_a,
        1,
        product_id=hortifruti["id"],
        name="Banana",
        unit_price=Decimal("42.50"),
        total_price=Decimal("42.50"),
    )

    # Carrinho SEM nota correspondente — conta pela soma dos itens.
    day_2 = _local_noon("2026-03-15")
    standalone_cart = await _closed_cart(db_conn, user_id, market_y["id"], day_2)
    await _cart_item(
        db_conn,
        standalone_cart,
        user_id,
        product_id=laticinios["id"],
        name="Leite",
        unit_price=Decimal("15.00"),
        quantity=Decimal("2"),
    )

    # Nota isolada, sem carrinho — conta pelo total_amount da nota.
    day_3 = _local_noon("2026-03-20")
    receipt_c = await _done_receipt(db_conn, user_id, market_z["id"], day_3, Decimal("9.90"))
    await _receipt_item(
        db_conn,
        receipt_c,
        1,
        product_id=sem_categoria["id"],
        name="Item genérico",
        unit_price=Decimal("9.90"),
        total_price=Decimal("9.90"),
    )

    res = await client.get("/api/reports/monthly", params={"month": "2026-03"}, headers=headers)
    assert res.status_code == 200
    body = res.json()

    assert body["purchase_count"] == 3
    # 42.50 (nota A) + 30.00 (carrinho: 15*2) + 9.90 (nota C)
    assert body["total_amount"] == "82.40"

    by_category = {row["category_name"]: row["amount"] for row in body["by_category"]}
    assert by_category["Hortifruti"] == "42.50"
    assert by_category["Laticínios"] == "30.00"
    assert by_category["Sem categoria"] == "9.90"


async def test_monthly_report_empty_month_returns_zero(client: AsyncClient, db_conn: Connection):
    headers, _ = await _auth_headers(db_conn)
    res = await client.get("/api/reports/monthly", params={"month": "2020-01"}, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total_amount"] == "0"
    assert body["purchase_count"] == 0
    assert body["by_category"] == []


async def test_monthly_report_invalid_month_is_400(client: AsyncClient, db_conn: Connection):
    headers, _ = await _auth_headers(db_conn)
    res = await client.get("/api/reports/monthly", params={"month": "not-a-month"}, headers=headers)
    assert res.status_code == 400


async def test_monthly_report_requires_auth(client: AsyncClient):
    res = await client.get("/api/reports/monthly", params={"month": "2026-03"})
    assert res.status_code == 401


async def test_purchases_list_reports_origin_and_is_scoped_per_user(
    client: AsyncClient, db_conn: Connection
):
    headers, user_id = await _auth_headers(db_conn)
    other_headers, other_user_id = await _auth_headers(db_conn)
    market = await _market(db_conn, "Mercado Compras")

    day_1 = _local_noon("2026-04-05")
    cart = await _closed_cart(db_conn, user_id, market["id"], day_1)
    await _cart_item(
        db_conn, cart, user_id, product_id=None, name="Item avulso", unit_price=Decimal("10.00")
    )

    day_2 = _local_noon("2026-04-06")
    receipt = await _done_receipt(db_conn, user_id, market["id"], day_2, Decimal("20.00"))
    await _receipt_item(
        db_conn,
        receipt,
        1,
        product_id=None,
        name="Item nota",
        unit_price=Decimal("20.00"),
        total_price=Decimal("20.00"),
    )

    # Compra de outro usuário nunca aparece na lista.
    other_cart_day = _local_noon("2026-04-07")
    other_market = await _market(db_conn, "Mercado de Outro Usuário")
    other_cart = await _closed_cart(db_conn, other_user_id, other_market["id"], other_cart_day)
    await _cart_item(
        db_conn,
        other_cart,
        other_user_id,
        product_id=None,
        name="Item de outro",
        unit_price=Decimal("99.00"),
    )

    res = await client.get("/api/reports/purchases", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    origins = {item["origin"] for item in body["items"]}
    assert origins == {"cart", "receipt"}
    # Mais recente primeiro.
    assert body["items"][0]["origin"] == "receipt"
    assert body["items"][0]["market_name"] == "Mercado Compras"

    other_res = await client.get("/api/reports/purchases", headers=other_headers)
    assert other_res.json()["total"] == 1


async def test_months_summary_returns_twelve_months_including_empty_ones(
    client: AsyncClient, db_conn: Connection
):
    headers, _ = await _auth_headers(db_conn)
    res = await client.get("/api/reports/months", headers=headers)
    assert res.status_code == 200
    months = res.json()
    assert len(months) == 12
    assert all(m["total_amount"] == "0" for m in months)
    # Ordem crescente (mais antigo → mais recente), meses consecutivos.
    keys = [m["month"] for m in months]
    assert keys == sorted(keys)
