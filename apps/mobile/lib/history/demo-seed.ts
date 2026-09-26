// Seed de demonstração do histórico (`?demo=1` em `app/(tabs)/history.tsx`) — mesma convenção do
// modo demo do scan (`lib/scan/demo-fixtures.ts`): a câmera/rede não existem em screenshot
// (Playwright/CI), então populamos o SQLite direto com dado fabricado, SEM outbox (nunca deve
// tentar sincronizar isso com o servidor). Só roda quando o histórico local está vazio.

import { insertCartItem } from "@/lib/db/cart-repository";
import { insertCart } from "@/lib/db/cart-repository";
import { getDb } from "@/lib/db/client";
import { insertReceipt } from "@/lib/db/receipts-repository";
import type { CartItemRow, CartRow, ReceiptItemCache, ReceiptRow } from "@/lib/db/types";

function iso(daysAgo: number, hour = 18): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function demoCart(overrides: Partial<CartRow> & Pick<CartRow, "client_id">): CartRow {
  const now = iso(0);
  return {
    market_id: null,
    market_name: null,
    status: "closed",
    budget_cents: 60000,
    started_at: now,
    closed_at: now,
    updated_at: now,
    field_versions: "{}",
    deleted_at: null,
    ...overrides,
  };
}

type DemoCartItemInput = Pick<
  CartItemRow,
  "client_id" | "cart_client_id" | "product_name" | "category" | "unit_price_cents" | "quantity_milli" | "total_cents"
> &
  Partial<CartItemRow>;

function demoCartItem(overrides: DemoCartItemInput): CartItemRow {
  const now = iso(0);
  return {
    product_id: null,
    ean: null,
    unit: "un",
    is_offer: 0,
    added_at: now,
    updated_at: now,
    field_versions: "{}",
    deleted_at: null,
    ...overrides,
  };
}

function demoReceipt(overrides: Partial<ReceiptRow> & Pick<ReceiptRow, "client_id" | "access_key">): ReceiptRow {
  const now = iso(0);
  return {
    server_id: `demo-server-${overrides.client_id}`,
    qr_text: `p=${overrides.access_key}|3|1`,
    cart_client_id: null,
    status: "done",
    failure_reason: null,
    failure_message: null,
    market_id: "demo-market",
    market_name: null,
    issued_at: now,
    total_amount_cents: 0,
    discount_amount_cents: null,
    items_json: "[]",
    created_at: now,
    updated_at: now,
    last_synced_at: now,
    attempts: 0,
    next_attempt_at: null,
    ...overrides,
  };
}

function receiptItems(items: readonly Omit<ReceiptItemCache, "id" | "lineNumber">[]): string {
  return JSON.stringify(
    items.map((item, index) => ({ id: `demo-item-${index}`, lineNumber: index + 1, ...item })),
  );
}

/** `true` quando semeou (histórico local estava vazio) — o call site recarrega os dados depois. */
export function seedDemoHistoryIfEmpty(): boolean {
  const db = getDb();
  const existingCart = db.getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM carts WHERE status = 'closed'");
  const existingReceipt = db.getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM receipts");
  if ((existingCart?.count ?? 0) > 0 || (existingReceipt?.count ?? 0) > 0) return false;

  db.withTransactionSync(() => {
    // Compra 1: só carrinho, mês atual — Bom Preço, 20/09.
    const cartA = demoCart({ client_id: "demo-cart-a", market_name: "Bom Preço", closed_at: iso(6), updated_at: iso(6) });
    insertCart(db, cartA);
    insertCartItem(
      db,
      demoCartItem({
        client_id: "demo-item-a1",
        cart_client_id: cartA.client_id,
        product_name: "Café Pilão 500 g",
        category: "mercearia",
        ean: "7891000100103",
        unit_price_cents: 1890,
        quantity_milli: 1000,
        total_cents: 1890,
        added_at: iso(6),
        updated_at: iso(6),
      }),
    );
    insertCartItem(
      db,
      demoCartItem({
        client_id: "demo-item-a2",
        cart_client_id: cartA.client_id,
        product_name: "Leite integral 1 L",
        category: "laticinios",
        ean: "7891000053508",
        unit_price_cents: 449,
        quantity_milli: 2000,
        total_cents: 898,
        added_at: iso(6),
        updated_at: iso(6),
      }),
    );
    insertCartItem(
      db,
      demoCartItem({
        client_id: "demo-item-a3",
        cart_client_id: cartA.client_id,
        product_name: "Tomate salada",
        category: "hortifruti",
        unit: "kg",
        unit_price_cents: 799,
        quantity_milli: 1200,
        total_cents: 959,
        added_at: iso(6),
        updated_at: iso(6),
      }),
    );

    // Compra 2: carrinho + nota casados (mesmo dia/mercado) — Mercado Central, 11/09.
    const cartB = demoCart({
      client_id: "demo-cart-b",
      market_name: "Mercado Central",
      closed_at: iso(15),
      updated_at: iso(15),
    });
    insertCart(db, cartB);
    insertCartItem(
      db,
      demoCartItem({
        client_id: "demo-item-b1",
        cart_client_id: cartB.client_id,
        product_name: "Arroz branco 5 kg",
        category: "mercearia",
        ean: "7896036090717",
        unit_price_cents: 2790,
        quantity_milli: 1000,
        total_cents: 2790,
        added_at: iso(15),
        updated_at: iso(15),
      }),
    );
    insertCartItem(
      db,
      demoCartItem({
        client_id: "demo-item-b2",
        cart_client_id: cartB.client_id,
        product_name: "Peito de frango",
        category: "carnes",
        unit: "kg",
        unit_price_cents: 2290,
        quantity_milli: 1500,
        total_cents: 3435,
        added_at: iso(15),
        updated_at: iso(15),
      }),
    );
    insertCartItem(
      db,
      demoCartItem({
        client_id: "demo-item-b3",
        cart_client_id: cartB.client_id,
        product_name: "Sabão em pó 1 kg",
        category: "limpeza",
        unit_price_cents: 1590,
        quantity_milli: 1000,
        total_cents: 1590,
        added_at: iso(15),
        updated_at: iso(15),
      }),
    );

    insertReceipt(
      db,
      demoReceipt({
        client_id: "demo-receipt-b",
        access_key: "52250911222333000181650010009999991123456780",
        market_name: "Mercado Central",
        issued_at: iso(15, 19),
        total_amount_cents: 7615,
        discount_amount_cents: 200,
        items_json: receiptItems([
          { ean: "7896036090717", rawName: "ARROZ BRANCO 5KG", quantity: "1.000", unit: "UN", unitPriceCents: 2790, totalPriceCents: 2790 },
          { ean: null, rawName: "PEITO FRANGO KG", quantity: "1.500", unit: "KG", unitPriceCents: 2290, totalPriceCents: 3435 },
          { ean: null, rawName: "DETERGENTE 500ML", quantity: "2.000", unit: "UN", unitPriceCents: 250, totalPriceCents: 500 },
        ]),
      }),
    );

    // Compra 3: só nota, mês anterior — Supermercado Catalão, 28/08.
    insertReceipt(
      db,
      demoReceipt({
        client_id: "demo-receipt-c",
        access_key: "52250911222333000181650010008888881123456781",
        market_name: "Supermercado Catalão",
        issued_at: iso(29, 19),
        total_amount_cents: 13290,
        discount_amount_cents: null,
        items_json: receiptItems([
          { ean: null, rawName: "PAO FRANCES KG", quantity: "0.600", unit: "KG", unitPriceCents: 1490, totalPriceCents: 894 },
          { ean: null, rawName: "REFRIGERANTE 2L", quantity: "2.000", unit: "UN", unitPriceCents: 890, totalPriceCents: 1780 },
          { ean: null, rawName: "QUEIJO MUSSARELA KG", quantity: "0.400", unit: "KG", unitPriceCents: 2790, totalPriceCents: 1116 },
        ]),
      }),
    );

    // Nota ainda em processamento (aparece em "Notas em andamento").
    insertReceipt(
      db,
      demoReceipt({
        client_id: "demo-receipt-pending",
        access_key: "52250911222333000181650010007777771123456782",
        server_id: "demo-server-pending",
        status: "pending",
        market_id: null,
        issued_at: null,
        total_amount_cents: null,
        created_at: iso(0, 10),
        updated_at: iso(0, 10),
      }),
    );
  });

  return true;
}
