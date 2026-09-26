// Contrato do carrinho entre os blocos da onda 3 (docs/fases-construcao.md).
//
// - 3B (scan + carrinho) CONSOME só o que está exportado aqui: tipos + hooks/ações.
// - 3A (dados + sync) implementa sobre expo-sqlite + outbox — mesmos nomes e
//   assinaturas do contrato original (useActiveCart, addCartItem,
//   updateCartItem, removeCartItem, setCartMarket, setCartBudget,
//   closeActiveCart). Nenhum dos dois muda este contrato sem combinar.
//
// Dinheiro sempre em centavos inteiros; quantidade em milésimos (1 un = 1000,
// 1,4 kg = 1400) para nunca somar float. Conversão pra string decimal só na
// borda do sync (lib/sync/money.ts) — o resto do app nunca vê float/decimal.

import type { JsonValue } from "@economerc/shared";
import { create } from "zustand";

import type { CategoryKey } from "@/lib/types";
import {
  findCartItemByClientId,
  findOpenCart,
  insertCart,
  insertCartItem,
  listActiveCartItems,
  updateCart as updateCartRow,
  updateCartItem as updateCartItemRow,
} from "@/lib/db/cart-repository";
import { getDb } from "@/lib/db/client";
import { bumpFieldVersions, parseFieldVersions, stringifyFieldVersions } from "@/lib/db/field-versions";
import { enqueueOutboxMutation } from "@/lib/db/outbox-repository";
import type { CartItemRow, CartRow } from "@/lib/db/types";
import { centsToDecimalString, milliToDecimalString } from "@/lib/sync/money";
import { scheduleSyncSoon } from "@/lib/sync/engine";

export type ProductUnit = "un" | "kg" | "g" | "l" | "ml";

/** O que o scan/lookup entrega para virar item do carrinho. */
export interface NewCartItemInput {
  ean: string | null; // null = item digitado sem código de barras
  productName: string;
  category: CategoryKey;
  unit: ProductUnit;
  unitPriceCents: number;
  quantityMilli: number;
  isOffer: boolean;
  productId: string | null; // id do servidor, quando o lookup encontrou
}

export interface CartItemRecord extends NewCartItemInput {
  clientId: string; // UUID v4 gerado no aparelho — chave do sync idempotente
  totalCents: number; // round(unitPriceCents * quantityMilli / 1000)
  addedAt: string; // ISO 8601 UTC
}

export interface ActiveCart {
  clientId: string;
  marketId: string | null;
  marketName: string | null;
  budgetCents: number | null;
  items: readonly CartItemRecord[];
  totalCents: number;
}

export interface CartItemPatch {
  unitPriceCents?: number;
  quantityMilli?: number;
  isOffer?: boolean;
}

export function computeItemTotalCents(unitPriceCents: number, quantityMilli: number): number {
  return Math.round((unitPriceCents * quantityMilli) / 1000);
}

// ---------------------------------------------------------------------------
// Implementação sobre SQLite + outbox. A UI lê do SQLite via um store zustand
// alimentado por `refreshCartStore()` a cada mutação — nunca escreve direto,
// sempre pelas funções abaixo (entidade + outbox na MESMA transação SQLite).
// ---------------------------------------------------------------------------

function newClientId(): string {
  return globalThis.crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function rowToItemRecord(row: CartItemRow): CartItemRecord {
  return {
    ean: row.ean,
    productName: row.product_name,
    category: row.category as CategoryKey,
    unit: row.unit,
    unitPriceCents: row.unit_price_cents,
    quantityMilli: row.quantity_milli,
    isOffer: row.is_offer === 1,
    productId: row.product_id,
    clientId: row.client_id,
    totalCents: row.total_cents,
    addedAt: row.added_at,
  };
}

/** Garante que existe um carrinho aberto local — cria (+ outbox) na 1ª leitura
 * do app ou logo depois de `closeActiveCart`. */
function ensureOpenCartRow(): CartRow {
  const db = getDb();
  const existing = findOpenCart(db);
  if (existing) return existing;

  const startedAt = nowIso();
  const clientId = newClientId();
  const fieldVersions = bumpFieldVersions({}, ["status", "startedAt"], startedAt);
  const row: CartRow = {
    client_id: clientId,
    market_id: null,
    market_name: null,
    status: "open",
    budget_cents: null,
    started_at: startedAt,
    closed_at: null,
    updated_at: startedAt,
    field_versions: stringifyFieldVersions(fieldVersions),
    deleted_at: null,
  };
  db.withTransactionSync(() => {
    insertCart(db, row);
    enqueueOutboxMutation(db, {
      entity: "cart",
      op: "upsert",
      clientId,
      fields: { status: "open", startedAt },
      updatedAt: startedAt,
    });
  });
  return row;
}

function loadActiveCartFromDb(): ActiveCart {
  const cartRow = ensureOpenCartRow();
  const items = listActiveCartItems(getDb(), cartRow.client_id).map(rowToItemRecord);
  const totalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  return {
    clientId: cartRow.client_id,
    marketId: cartRow.market_id,
    marketName: cartRow.market_name,
    budgetCents: cartRow.budget_cents,
    items,
    totalCents,
  };
}

const useCartStore = create<{ cart: ActiveCart }>(() => ({ cart: loadActiveCartFromDb() }));

function refreshCartStore(): void {
  useCartStore.setState({ cart: loadActiveCartFromDb() });
}

export function useActiveCart(): ActiveCart {
  return useCartStore((state) => state.cart);
}

export async function addCartItem(input: NewCartItemInput): Promise<CartItemRecord> {
  const db = getDb();
  const cartRow = ensureOpenCartRow();
  const addedAt = nowIso();
  const clientId = newClientId();
  const totalCents = computeItemTotalCents(input.unitPriceCents, input.quantityMilli);

  const outboxFields: Record<string, JsonValue> = {
    cartClientId: cartRow.client_id,
    productId: input.productId,
    ean: input.ean,
    productName: input.productName,
    unitPrice: centsToDecimalString(input.unitPriceCents),
    quantity: milliToDecimalString(input.quantityMilli),
    unit: input.unit,
    isOffer: input.isOffer,
  };
  const fieldVersions = bumpFieldVersions({}, Object.keys(outboxFields), addedAt);

  const row: CartItemRow = {
    client_id: clientId,
    cart_client_id: cartRow.client_id,
    product_id: input.productId,
    ean: input.ean,
    product_name: input.productName,
    category: input.category,
    unit: input.unit,
    unit_price_cents: input.unitPriceCents,
    quantity_milli: input.quantityMilli,
    is_offer: input.isOffer ? 1 : 0,
    total_cents: totalCents,
    added_at: addedAt,
    updated_at: addedAt,
    field_versions: stringifyFieldVersions(fieldVersions),
    deleted_at: null,
  };

  db.withTransactionSync(() => {
    insertCartItem(db, row);
    enqueueOutboxMutation(db, {
      entity: "cart_item",
      op: "upsert",
      clientId,
      fields: outboxFields,
      updatedAt: addedAt,
    });
  });

  refreshCartStore();
  scheduleSyncSoon();
  return rowToItemRecord(row);
}

export async function updateCartItem(clientId: string, patch: CartItemPatch): Promise<void> {
  const db = getDb();
  const existing = findCartItemByClientId(db, clientId);
  if (!existing || existing.deleted_at !== null) return;

  const now = nowIso();
  const nextUnitPriceCents = patch.unitPriceCents ?? existing.unit_price_cents;
  const nextQuantityMilli = patch.quantityMilli ?? existing.quantity_milli;
  const totalCents = computeItemTotalCents(nextUnitPriceCents, nextQuantityMilli);

  const outboxFields: Record<string, JsonValue> = {};
  const columnPatch: Partial<Omit<CartItemRow, "client_id">> = {
    total_cents: totalCents,
    updated_at: now,
  };
  if (patch.unitPriceCents !== undefined) {
    columnPatch.unit_price_cents = patch.unitPriceCents;
    outboxFields.unitPrice = centsToDecimalString(patch.unitPriceCents);
  }
  if (patch.quantityMilli !== undefined) {
    columnPatch.quantity_milli = patch.quantityMilli;
    outboxFields.quantity = milliToDecimalString(patch.quantityMilli);
  }
  if (patch.isOffer !== undefined) {
    columnPatch.is_offer = patch.isOffer ? 1 : 0;
    outboxFields.isOffer = patch.isOffer;
  }
  if (Object.keys(outboxFields).length === 0) return;

  const fieldVersions = bumpFieldVersions(
    parseFieldVersions(existing.field_versions),
    Object.keys(outboxFields),
    now,
  );
  columnPatch.field_versions = stringifyFieldVersions(fieldVersions);

  db.withTransactionSync(() => {
    updateCartItemRow(db, clientId, columnPatch);
    enqueueOutboxMutation(db, {
      entity: "cart_item",
      op: "upsert",
      clientId,
      fields: outboxFields,
      updatedAt: now,
    });
  });

  refreshCartStore();
  scheduleSyncSoon();
}

export async function removeCartItem(clientId: string): Promise<void> {
  const db = getDb();
  const existing = findCartItemByClientId(db, clientId);
  if (!existing || existing.deleted_at !== null) return;
  const now = nowIso();

  db.withTransactionSync(() => {
    updateCartItemRow(db, clientId, { deleted_at: now, updated_at: now });
    enqueueOutboxMutation(db, { entity: "cart_item", op: "delete", clientId, fields: {}, updatedAt: now });
  });

  refreshCartStore();
  scheduleSyncSoon();
}

export async function setCartMarket(marketId: string | null, marketName: string | null): Promise<void> {
  const db = getDb();
  const cartRow = ensureOpenCartRow();
  const now = nowIso();

  db.withTransactionSync(() => {
    if (marketId === null) {
      // `market_name` é local-only (nunca vai pro outbox); limpar o mercado
      // não tem representação no contrato de sync (backend `exclude_none`
      // descarta campo nulo), então só atualiza o lado local.
      updateCartRow(db, cartRow.client_id, { market_id: null, market_name: marketName, updated_at: now });
      return;
    }
    const fieldVersions = bumpFieldVersions(parseFieldVersions(cartRow.field_versions), ["marketId"], now);
    updateCartRow(db, cartRow.client_id, {
      market_id: marketId,
      market_name: marketName,
      updated_at: now,
      field_versions: stringifyFieldVersions(fieldVersions),
    });
    enqueueOutboxMutation(db, {
      entity: "cart",
      op: "upsert",
      clientId: cartRow.client_id,
      fields: { marketId },
      updatedAt: now,
    });
  });

  refreshCartStore();
  scheduleSyncSoon();
}

export async function setCartBudget(budgetCents: number | null): Promise<void> {
  const db = getDb();
  const cartRow = ensureOpenCartRow();
  const now = nowIso();

  db.withTransactionSync(() => {
    if (budgetCents === null) {
      updateCartRow(db, cartRow.client_id, { budget_cents: null, updated_at: now });
      return;
    }
    const fieldVersions = bumpFieldVersions(parseFieldVersions(cartRow.field_versions), ["budget"], now);
    updateCartRow(db, cartRow.client_id, {
      budget_cents: budgetCents,
      updated_at: now,
      field_versions: stringifyFieldVersions(fieldVersions),
    });
    enqueueOutboxMutation(db, {
      entity: "cart",
      op: "upsert",
      clientId: cartRow.client_id,
      fields: { budget: centsToDecimalString(budgetCents) },
      updatedAt: now,
    });
  });

  refreshCartStore();
  scheduleSyncSoon();
}

/** Fecha a compra atual (vai pro histórico) e abre um carrinho vazio. */
export async function closeActiveCart(): Promise<void> {
  const db = getDb();
  const cartRow = ensureOpenCartRow();
  const now = nowIso();
  const fieldVersions = bumpFieldVersions(
    parseFieldVersions(cartRow.field_versions),
    ["status", "closedAt"],
    now,
  );

  db.withTransactionSync(() => {
    updateCartRow(db, cartRow.client_id, {
      status: "closed",
      closed_at: now,
      updated_at: now,
      field_versions: stringifyFieldVersions(fieldVersions),
    });
    enqueueOutboxMutation(db, {
      entity: "cart",
      op: "upsert",
      clientId: cartRow.client_id,
      fields: { status: "closed", closedAt: now },
      updatedAt: now,
    });
  });

  ensureOpenCartRow(); // abre o próximo carrinho (insert + outbox) na mesma passada

  refreshCartStore();
  scheduleSyncSoon();
}
