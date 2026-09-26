// Fila offline de notas (Onda 5, docs/nfce-sefaz-go.md) — mesmo princípio do outbox de
// carrinho (rules/mobile.md > offline-first), mas contra `POST /receipts`/`GET /receipts/{id}`
// em vez de `/sync/push`/`/sync/pull`: uma nota lida em modo avião fica `queued` em
// `receipts` (SQLite) e é enviada quando a rede volta; depois de enviada, o mesmo motor faz
// polling educado até o servidor devolver `done`/`failed`/`duplicate`.
//
// Hook de rede: `lib/sync/engine.ts` chama `syncReceiptsQueue()` nos MESMOS gatilhos do sync do
// carrinho (reconexão, foreground, debounce) — reusa o motor existente sem alterar o contrato
// dele (`triggerSyncNow`/`useSyncStateStore` continuam iguais).

import { getDb } from "@/lib/db/client";
import {
  findReceiptByAccessKey,
  findReceiptByClientId,
  insertReceipt,
  listQueuedReceipts,
  listReceiptsAwaitingResult,
  updateReceipt,
} from "@/lib/db/receipts-repository";
import type { ReceiptItemCache, ReceiptQueueStatus, ReceiptRow } from "@/lib/db/types";
import { decimalStringToCents } from "@/lib/sync/money";

import { getMarket } from "@/lib/api/markets";
import { createReceipt, getReceipt, type ReceiptDetailResponseBody, type ReceiptResponseBody } from "@/lib/api/receipts";
import { ApiRequestError } from "@/lib/api/errors";

const QUEUE_DRAIN_LIMIT = 10; // uma pessoa não lê 10 notas por sessão; guarda contra loop
const BASE_BACKOFF_MS = 3000;
const MAX_BACKOFF_MS = 60_000;

function nowIso(): string {
  return new Date().toISOString();
}

function newClientId(): string {
  return globalThis.crypto.randomUUID();
}

function computeBackoffMs(attempts: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(exponential, MAX_BACKOFF_MS);
}

/** Enfileira o `qr_text` já validado (`validateNfceQr`) — nunca bloqueia esperando a rede.
 * Reaproveita a linha existente se a MESMA chave já foi lida antes (evita duplicar a fila
 * quando o usuário escaneia a mesma nota duas vezes antes do 1º envio terminar). */
export function enqueueReceiptFromQr(input: {
  qrText: string;
  accessKey: string;
  cartClientId: string | null;
}): ReceiptRow {
  const db = getDb();
  const existing = findReceiptByAccessKey(db, input.accessKey);
  if (existing) return existing;

  const timestamp = nowIso();
  const row: ReceiptRow = {
    client_id: newClientId(),
    server_id: null,
    qr_text: input.qrText,
    access_key: input.accessKey,
    cart_client_id: input.cartClientId,
    status: "queued",
    failure_reason: null,
    failure_message: null,
    market_id: null,
    market_name: null,
    issued_at: null,
    total_amount_cents: null,
    discount_amount_cents: null,
    items_json: "[]",
    created_at: timestamp,
    updated_at: timestamp,
    last_synced_at: null,
    attempts: 0,
    next_attempt_at: null,
  };
  insertReceipt(db, row);
  return row;
}

function toItemsCache(items: ReceiptDetailResponseBody["items"]): ReceiptItemCache[] {
  return items.map((item) => ({
    id: item.id,
    lineNumber: item.lineNumber,
    ean: item.ean,
    rawName: item.rawName,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceCents: decimalStringToCents(item.unitPrice),
    totalPriceCents: decimalStringToCents(item.totalPrice),
  }));
}

/** Resolve o nome do mercado uma única vez por nota — persistido, nunca refeito a cada poll. */
async function resolveMarketName(marketId: string): Promise<string | null> {
  try {
    const market = await getMarket(marketId);
    return market.tradeName;
  } catch {
    return null; // sem nome agora; próximo poll com sucesso tenta de novo (market_name continua null)
  }
}

async function applyServerResponse(
  clientId: string,
  body: ReceiptResponseBody,
  items: ReceiptDetailResponseBody["items"] | null,
): Promise<void> {
  const db = getDb();
  const existing = findReceiptByClientId(db, clientId);
  const marketName =
    body.marketId && body.marketId !== existing?.market_id
      ? await resolveMarketName(body.marketId)
      : (existing?.market_name ?? null);

  updateReceipt(db, clientId, {
    server_id: body.id,
    status: body.status as ReceiptQueueStatus,
    failure_reason: body.failureReason,
    failure_message: body.failureMessage,
    market_id: body.marketId,
    market_name: marketName,
    issued_at: body.issuedAt,
    total_amount_cents: body.totalAmount ? decimalStringToCents(body.totalAmount) : null,
    discount_amount_cents: body.discountAmount ? decimalStringToCents(body.discountAmount) : null,
    items_json: items ? JSON.stringify(toItemsCache(items)) : (existing?.items_json ?? "[]"),
    updated_at: nowIso(),
    last_synced_at: nowIso(),
    attempts: 0,
    next_attempt_at: null,
  });
}

/** Envia as notas ainda não mandadas ao servidor (`status = 'queued'`). Nunca lança — erro de
 * rede só reagenda com backoff, igual ao outbox do carrinho. */
async function drainReceiptQueue(): Promise<void> {
  const db = getDb();
  const pending = listQueuedReceipts(db, QUEUE_DRAIN_LIMIT);

  for (const row of pending) {
    try {
      const created = await createReceipt({ qrText: row.qr_text, clientId: row.client_id });
      await applyServerResponse(row.client_id, created, null);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) {
        // QR rejeitado pelo backend (400) — não é transitório, não adianta reenviar.
        // `error.message` já é o `detail` pt-BR do backend (`ApiRequestError`) — serve como as
        // duas coisas: motivo técnico e mensagem amigável (não tem um par distinto aqui).
        updateReceipt(db, row.client_id, {
          status: "failed",
          failure_reason: error.message,
          failure_message: error.message,
          updated_at: nowIso(),
        });
        continue;
      }
      const attempts = row.attempts + 1;
      updateReceipt(db, row.client_id, {
        attempts,
        next_attempt_at: new Date(Date.now() + computeBackoffMs(attempts)).toISOString(),
        updated_at: nowIso(),
      });
    }
  }
}

/** Poll educado: só as notas que ainda podem mudar de status, e só quando há `server_id`. */
async function pollReceiptsAwaitingResult(): Promise<void> {
  const db = getDb();
  const awaiting = listReceiptsAwaitingResult(db);

  for (const row of awaiting) {
    if (!row.server_id) continue;
    try {
      const detail = await getReceipt(row.server_id);
      await applyServerResponse(row.client_id, detail, detail.items);
    } catch {
      // Falha de poll não é fatal — o próximo gatilho de sync tenta de novo.
    }
  }
}

/** Chamado pelo `lib/sync/engine.ts` nos mesmos gatilhos do sync do carrinho. */
export async function syncReceiptsQueue(): Promise<void> {
  await drainReceiptQueue();
  await pollReceiptsAwaitingResult();
}

/** Poll único e imediato de UMA nota (tela de acompanhamento — refetch ao focar). Devolve a
 * linha atualizada; nunca lança (rede fora = a UI mostra o último estado em cache). */
export async function refetchReceipt(clientId: string): Promise<ReceiptRow | null> {
  const db = getDb();
  const row = findReceiptByClientId(db, clientId);
  if (!row) return null;
  if (row.status === "queued") {
    await drainReceiptQueue();
  } else if (row.server_id && (row.status === "pending" || row.status === "processing")) {
    try {
      const detail = await getReceipt(row.server_id);
      await applyServerResponse(row.client_id, detail, detail.items);
    } catch {
      // mantém o cache local
    }
  }
  return findReceiptByClientId(db, clientId);
}
