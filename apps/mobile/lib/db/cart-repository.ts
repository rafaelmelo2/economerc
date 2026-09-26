// CRUD SQLite de `carts`/`cart_items` — só SQL, zero regra de negócio (a
// orquestração de mutação + outbox vive em `lib/cart/contract.ts`, que é quem
// decide o que vira `field_versions`/outbox). Espelha
// `backend/src/api/repositories/carts/*` na forma (uma função por operação).

import type { SQLiteDatabase } from "expo-sqlite";

import type { CartItemRow, CartRow } from "./types";

export function findOpenCart(db: SQLiteDatabase): CartRow | null {
  return db.getFirstSync<CartRow>(
    "SELECT * FROM carts WHERE status = 'open' AND deleted_at IS NULL ORDER BY started_at DESC LIMIT 1",
  );
}

export function findCartByClientId(db: SQLiteDatabase, clientId: string): CartRow | null {
  return db.getFirstSync<CartRow>("SELECT * FROM carts WHERE client_id = ?", clientId);
}

export function insertCart(db: SQLiteDatabase, row: CartRow): void {
  db.runSync(
    `INSERT INTO carts
       (client_id, market_id, market_name, status, budget_cents, started_at,
        closed_at, updated_at, field_versions, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.client_id,
    row.market_id,
    row.market_name,
    row.status,
    row.budget_cents,
    row.started_at,
    row.closed_at,
    row.updated_at,
    row.field_versions,
    row.deleted_at,
  );
}

/** Patch parcial — só as colunas presentes em `patch` são sobrescritas. */
export function updateCart(
  db: SQLiteDatabase,
  clientId: string,
  patch: Partial<Omit<CartRow, "client_id">>,
): void {
  const entries = Object.entries(patch);
  if (entries.length === 0) return;
  const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  db.runSync(`UPDATE carts SET ${assignments} WHERE client_id = ?`, ...values, clientId);
}

export function listActiveCartItems(db: SQLiteDatabase, cartClientId: string): CartItemRow[] {
  return db.getAllSync<CartItemRow>(
    "SELECT * FROM cart_items WHERE cart_client_id = ? AND deleted_at IS NULL ORDER BY added_at DESC",
    cartClientId,
  );
}

export function findCartItemByClientId(db: SQLiteDatabase, clientId: string): CartItemRow | null {
  return db.getFirstSync<CartItemRow>("SELECT * FROM cart_items WHERE client_id = ?", clientId);
}

export function insertCartItem(db: SQLiteDatabase, row: CartItemRow): void {
  db.runSync(
    `INSERT INTO cart_items
       (client_id, cart_client_id, product_id, ean, product_name, category, unit,
        unit_price_cents, quantity_milli, is_offer, total_cents, added_at,
        updated_at, field_versions, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.client_id,
    row.cart_client_id,
    row.product_id,
    row.ean,
    row.product_name,
    row.category,
    row.unit,
    row.unit_price_cents,
    row.quantity_milli,
    row.is_offer,
    row.total_cents,
    row.added_at,
    row.updated_at,
    row.field_versions,
    row.deleted_at,
  );
}

export function updateCartItem(
  db: SQLiteDatabase,
  clientId: string,
  patch: Partial<Omit<CartItemRow, "client_id">>,
): void {
  const entries = Object.entries(patch);
  if (entries.length === 0) return;
  const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  db.runSync(`UPDATE cart_items SET ${assignments} WHERE client_id = ?`, ...values, clientId);
}
