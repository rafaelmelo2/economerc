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

// Espelha `ReceiptStatus` do backend (`schemas/receipts/receipt.py`) + o estado local
// `queued` (ainda não chegou a mandar `POST /receipts` — ver `lib/receipts/queue.ts`).
export type ReceiptQueueStatus = "queued" | "pending" | "processing" | "done" | "failed" | "duplicate";

/** Item cacheado de `ReceiptItemResponse` (camelCase, dinheiro em centavos) — serializado em
 * `receipts.items_json`. `quantity` fica como string decimal (exibição só; nunca vira float). */
export interface ReceiptItemCache {
  id: string;
  lineNumber: number;
  ean: string | null;
  rawName: string;
  quantity: string;
  unit: string | null;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface ReceiptRow {
  client_id: string;
  server_id: string | null;
  qr_text: string;
  access_key: string;
  cart_client_id: string | null;
  status: ReceiptQueueStatus;
  failure_reason: string | null;
  market_id: string | null;
  market_name: string | null;
  issued_at: string | null;
  total_amount_cents: number | null;
  discount_amount_cents: number | null;
  items_json: string; // ReceiptItemCache[]
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
  attempts: number;
  next_attempt_at: string | null;
}
