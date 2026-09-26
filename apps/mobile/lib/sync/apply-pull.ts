// Aplica uma página de `GET /sync/pull` no SQLite local — a parte "com I/O"
// do pull; a decisão de quais campos vencem é 100% de `pull-reducer.ts`
// (lógica pura, testada isolada). Espelha `sync_service._apply_*` do backend:
// tombstone é terminal, upsert cria se não existir localmente ainda (cenário
// multi-aparelho futuro — hoje Fase 1 é single-device, mas o pull SEMPRE
// devolve o próprio histórico do usuário, nunca de terceiros).

import type { SQLiteDatabase } from "expo-sqlite";

import {
  findCartByClientId,
  findCartItemByClientId,
  insertCart,
  insertCartItem,
  updateCart,
  updateCartItem,
} from "@/lib/db/cart-repository";
import { parseFieldVersions, stringifyFieldVersions } from "@/lib/db/field-versions";
import type { CartItemRow, CartRow } from "@/lib/db/types";
import { decimalStringToCents, decimalStringToMilli } from "@/lib/sync/money";

import { applyPulledChange, type LocalEntitySnapshot, type PulledChange } from "./pull-reducer";

const CART_ITEM_DEFAULT_CATEGORY = "outros"; // campo local-only; pull nunca traz categoria

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function applyCartChange(db: SQLiteDatabase, change: PulledChange): void {
  const existing = findCartByClientId(db, change.clientId);
  const snapshot: LocalEntitySnapshot | null = existing
    ? { fieldVersions: parseFieldVersions(existing.field_versions), deletedAt: existing.deleted_at }
    : null;
  const result = applyPulledChange(snapshot, change);
  if (!result.changed) return;

  const fields = result.fieldsToPersist;
  const fieldVersions = stringifyFieldVersions(result.fieldVersions);

  if (existing) {
    updateCart(db, change.clientId, {
      market_id: "marketId" in fields ? asString(fields.marketId) : existing.market_id,
      status: "status" in fields ? (fields.status as CartRow["status"]) : existing.status,
      budget_cents:
        "budget" in fields ? decimalStringToCents(fields.budget as string) : existing.budget_cents,
      started_at: "startedAt" in fields ? asString(fields.startedAt) ?? existing.started_at : existing.started_at,
      closed_at: "closedAt" in fields ? asString(fields.closedAt) : existing.closed_at,
      updated_at: change.updatedAt,
      field_versions: fieldVersions,
      deleted_at: result.deletedAt,
    });
    return;
  }

  const row: CartRow = {
    client_id: change.clientId,
    market_id: asString(fields.marketId ?? null),
    market_name: null,
    status: (fields.status as CartRow["status"]) ?? "open",
    budget_cents: "budget" in fields ? decimalStringToCents(fields.budget as string) : null,
    started_at: asString(fields.startedAt) ?? change.updatedAt,
    closed_at: asString(fields.closedAt ?? null),
    updated_at: change.updatedAt,
    field_versions: fieldVersions,
    deleted_at: result.deletedAt,
  };
  insertCart(db, row);
}

function applyCartItemChange(db: SQLiteDatabase, change: PulledChange): void {
  const existing = findCartItemByClientId(db, change.clientId);
  const snapshot: LocalEntitySnapshot | null = existing
    ? { fieldVersions: parseFieldVersions(existing.field_versions), deletedAt: existing.deleted_at }
    : null;
  const result = applyPulledChange(snapshot, change);
  if (!result.changed) return;

  const fields = result.fieldsToPersist;
  const fieldVersions = stringifyFieldVersions(result.fieldVersions);
  const unitPriceCents =
    "unitPrice" in fields ? decimalStringToCents(fields.unitPrice as string) : existing?.unit_price_cents;
  const quantityMilli =
    "quantity" in fields ? decimalStringToMilli(fields.quantity as string) : existing?.quantity_milli;
  const totalCents =
    unitPriceCents != null && quantityMilli != null
      ? Math.round((unitPriceCents * quantityMilli) / 1000)
      : (existing?.total_cents ?? 0);

  if (existing) {
    updateCartItem(db, change.clientId, {
      product_id: "productId" in fields ? asString(fields.productId) : existing.product_id,
      ean: "ean" in fields ? asString(fields.ean) : existing.ean,
      product_name: "productName" in fields ? (fields.productName as string) : existing.product_name,
      unit: "unit" in fields ? (fields.unit as CartItemRow["unit"]) : existing.unit,
      unit_price_cents: unitPriceCents ?? existing.unit_price_cents,
      quantity_milli: quantityMilli ?? existing.quantity_milli,
      is_offer: "isOffer" in fields ? (asBoolean(fields.isOffer, false) ? 1 : 0) : existing.is_offer,
      total_cents: totalCents,
      updated_at: change.updatedAt,
      field_versions: fieldVersions,
      deleted_at: result.deletedAt,
    });
    return;
  }

  if (result.deletedAt) return; // tombstone de item que nunca existiu localmente — nada a criar

  const row: CartItemRow = {
    client_id: change.clientId,
    cart_client_id: asString(fields.cartClientId) ?? "",
    product_id: asString(fields.productId ?? null),
    ean: asString(fields.ean ?? null),
    product_name: (fields.productName as string) ?? "",
    category: CART_ITEM_DEFAULT_CATEGORY,
    unit: (fields.unit as CartItemRow["unit"]) ?? "un",
    unit_price_cents: unitPriceCents ?? 0,
    quantity_milli: quantityMilli ?? 1000,
    is_offer: asBoolean(fields.isOffer, false) ? 1 : 0,
    total_cents: totalCents,
    added_at: change.updatedAt,
    updated_at: change.updatedAt,
    field_versions: fieldVersions,
    deleted_at: null,
  };
  insertCartItem(db, row);
}

export function applyPulledChangeToDb(db: SQLiteDatabase, change: PulledChange): void {
  if (change.entity === "cart") {
    applyCartChange(db, change);
    return;
  }
  applyCartItemChange(db, change);
}
