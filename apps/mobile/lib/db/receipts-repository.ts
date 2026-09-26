// CRUD SQLite da fila/cache de notas (`lib/db/migrations.ts` v2) — só SQL, zero regra de
// negócio (orquestração de fila/poll vive em `lib/receipts/queue.ts`, mesma separação de
// `cart-repository.ts` / `lib/cart/contract.ts`).

import type { SQLiteDatabase } from "expo-sqlite";

import type { ReceiptRow } from "./types";

export function insertReceipt(db: SQLiteDatabase, row: ReceiptRow): void {
  db.runSync(
    `INSERT INTO receipts
       (client_id, server_id, qr_text, access_key, cart_client_id, status, failure_reason,
        failure_message, market_id, market_name, issued_at, total_amount_cents,
        discount_amount_cents, items_json, created_at, updated_at, last_synced_at, attempts,
        next_attempt_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.client_id,
    row.server_id,
    row.qr_text,
    row.access_key,
    row.cart_client_id,
    row.status,
    row.failure_reason,
    row.failure_message,
    row.market_id,
    row.market_name,
    row.issued_at,
    row.total_amount_cents,
    row.discount_amount_cents,
    row.items_json,
    row.created_at,
    row.updated_at,
    row.last_synced_at,
    row.attempts,
    row.next_attempt_at,
  );
}

export function updateReceipt(
  db: SQLiteDatabase,
  clientId: string,
  patch: Partial<Omit<ReceiptRow, "client_id">>,
): void {
  const entries = Object.entries(patch);
  if (entries.length === 0) return;
  const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  db.runSync(`UPDATE receipts SET ${assignments} WHERE client_id = ?`, ...values, clientId);
}

export function findReceiptByClientId(db: SQLiteDatabase, clientId: string): ReceiptRow | null {
  return db.getFirstSync<ReceiptRow>("SELECT * FROM receipts WHERE client_id = ?", clientId);
}

export function findReceiptByAccessKey(db: SQLiteDatabase, accessKey: string): ReceiptRow | null {
  return db.getFirstSync<ReceiptRow>(
    "SELECT * FROM receipts WHERE access_key = ? ORDER BY created_at DESC LIMIT 1",
    accessKey,
  );
}

/** Linhas que ainda não chegaram a mandar `POST /receipts` (novas ou falhas retryable). */
export function listQueuedReceipts(db: SQLiteDatabase, limit: number): ReceiptRow[] {
  return db.getAllSync<ReceiptRow>(
    `SELECT * FROM receipts
       WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY created_at ASC
     LIMIT ?`,
    new Date().toISOString(),
    limit,
  );
}

/** Linhas com `server_id` que ainda podem mudar de status — alvo do poll educado. */
export function listReceiptsAwaitingResult(db: SQLiteDatabase): ReceiptRow[] {
  return db.getAllSync<ReceiptRow>(
    "SELECT * FROM receipts WHERE server_id IS NOT NULL AND status IN ('pending', 'processing') ORDER BY created_at ASC",
  );
}

/** Todas as notas prontas — entram no histórico junto dos carrinhos fechados. */
export function listDoneReceipts(db: SQLiteDatabase): ReceiptRow[] {
  return db.getAllSync<ReceiptRow>(
    "SELECT * FROM receipts WHERE status IN ('done', 'duplicate') ORDER BY issued_at DESC",
  );
}

export function listAllReceipts(db: SQLiteDatabase): ReceiptRow[] {
  return db.getAllSync<ReceiptRow>("SELECT * FROM receipts ORDER BY created_at DESC");
}
