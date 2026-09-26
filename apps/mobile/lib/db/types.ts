// Shapes das linhas exatamente como o SQLite devolve (snake_case, sem
// conversão) — o boundary camelCase mora em `lib/cart/contract.ts` e
// `lib/sync/**`, nunca aqui.

export interface CartRow {
  client_id: string;
  market_id: string | null;
  market_name: string | null;
  status: "open" | "closed" | "cancelled";
  budget_cents: number | null;
  started_at: string;
  closed_at: string | null;
  updated_at: string;
  field_versions: string; // JSON — ver field-versions.ts
  deleted_at: string | null;
}

export interface CartItemRow {
  client_id: string;
  cart_client_id: string;
  product_id: string | null;
  ean: string | null;
  product_name: string;
  category: string;
  unit: "un" | "kg" | "g" | "l" | "ml";
  unit_price_cents: number;
  quantity_milli: number;
  is_offer: number; // SQLite não tem boolean — 0/1
  total_cents: number;
  added_at: string;
  updated_at: string;
  field_versions: string;
  deleted_at: string | null;
}

export type OutboxEntity = "cart" | "cart_item";
export type OutboxOp = "upsert" | "delete";

export interface OutboxRow {
  id: number;
  entity: OutboxEntity;
  op: OutboxOp;
  client_id: string;
  fields: string; // JSON dict — mesmo shape de `SyncMutation.fields`
  updated_at: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
}

export interface SyncStateRow {
  id: 1;
  cursor: string | null;
  last_synced_at: string | null;
}

export interface ProductCacheRow {
  ean: string;
  product_id: string | null;
  name: string;
  brand: string | null;
  category_id: string | null;
  unit: string;
  net_quantity: string | null;
  fetched_at: string;
}
