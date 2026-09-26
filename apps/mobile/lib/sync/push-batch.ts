// Monta o lote de `POST /sync/push` a partir das linhas pendentes do outbox —
// lógica pura (sem SQLite, sem fetch), testável isolada
// (`lib/sync/push-batch.test.ts`). O `ApiClient` (packages/shared) converte
// `clientId`→`client_id`/`updatedAt`→`updated_at` e os campos aninhados de
// `fields` na borda — aqui tudo fica em camelCase.

import { type JsonValue, MAX_PUSH_BATCH_SIZE } from "@economerc/shared";

import type { OutboxRow } from "@/lib/db/types";

// `type` (não `interface`) de propósito: só um alias de object type satisfaz a
// checagem estrutural contra `JsonValue` (index signature) no call site que
// manda isto pro `ApiClient` — `interface` nunca ganha índice implícito.
export type OutboxMutationPayload = {
  entity: "cart" | "cart_item";
  op: "upsert" | "delete";
  clientId: string;
  updatedAt: string;
  fields: Record<string, JsonValue>;
};

/** Ordem de `rows` importa: um `cart_item` referencia o `cart_client_id` do
 * carrinho, que precisa ter sido enviado antes no MESMO lote (o backend
 * processa sequencialmente — `apply_push_batch`). `listPendingOutbox` já
 * devolve por `created_at ASC`. */
export function buildPushBatch(rows: readonly OutboxRow[]): OutboxMutationPayload[] {
  return rows.slice(0, MAX_PUSH_BATCH_SIZE).map((row) => ({
    entity: row.entity,
    op: row.op,
    clientId: row.client_id,
    updatedAt: row.updated_at,
    fields: JSON.parse(row.fields) as Record<string, JsonValue>,
  }));
}
