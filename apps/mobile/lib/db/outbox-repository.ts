// Fila de mutações pendentes (rules/mobile.md > outbox). Cada linha já traz o
// shape exato que `POST /sync/push` espera (`entity`/`op`/`client_id`/
// `updated_at`/`fields`) — o motor de sync (`lib/sync/engine.ts`) só lê e
// drena, nunca decide o que entra aqui (isso é `lib/cart/contract.ts`).

import type { JsonValue } from "@economerc/shared";
import type { SQLiteDatabase } from "expo-sqlite";

import type { OutboxEntity, OutboxOp, OutboxRow } from "./types";

export interface EnqueueOutboxInput {
  entity: OutboxEntity;
  op: OutboxOp;
  clientId: string;
  fields: Record<string, JsonValue>;
  updatedAt: string;
}

/** Insere a linha do outbox. Chamada SEMPRE dentro da mesma transação SQLite
 * que grava a entidade (`db.withTransactionSync`) — mutação local vira as duas
 * escritas atomicamente, ou nenhuma. */
export function enqueueOutboxMutation(db: SQLiteDatabase, input: EnqueueOutboxInput): void {
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO outbox (entity, op, client_id, fields, updated_at, created_at, attempts, last_error, next_attempt_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL)`,
    input.entity,
    input.op,
    input.clientId,
    JSON.stringify(input.fields),
    input.updatedAt,
    now,
  );
}

export function listPendingOutbox(db: SQLiteDatabase, limit: number): OutboxRow[] {
  return db.getAllSync<OutboxRow>(
    `SELECT * FROM outbox
       WHERE next_attempt_at IS NULL OR next_attempt_at <= ?
     ORDER BY created_at ASC, id ASC
     LIMIT ?`,
    new Date().toISOString(),
    limit,
  );
}

export function countPendingOutbox(db: SQLiteDatabase): number {
  return db.getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM outbox")?.count ?? 0;
}

export function deleteOutboxRow(db: SQLiteDatabase, id: number): void {
  db.runSync("DELETE FROM outbox WHERE id = ?", id);
}

export function markOutboxAttemptFailed(
  db: SQLiteDatabase,
  id: number,
  error: string,
  nextAttemptAt: string,
): void {
  db.runSync(
    "UPDATE outbox SET attempts = attempts + 1, last_error = ?, next_attempt_at = ? WHERE id = ?",
    error,
    nextAttemptAt,
    id,
  );
}
