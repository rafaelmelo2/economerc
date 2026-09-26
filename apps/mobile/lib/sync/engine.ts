// Motor de sync (rules/mobile.md > outbox): drena o outbox em lotes, puxa por
// cursor aplicando LWW/tombstone, dispara em foreground/reconexão/após
// mutação (debounce)/manual, backoff exponencial, nunca bloqueia a UI —
// `triggerSyncNow` sempre roda em segundo plano (fire-and-forget pra quem
// chama; o estado observável é `useSyncStateStore`).

import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";

import { pullSyncChanges, pushSyncBatch } from "@/lib/api/sync";
import { getDb } from "@/lib/db/client";
import {
  countPendingOutbox,
  deleteOutboxRow,
  listPendingOutbox,
  markOutboxAttemptFailed,
} from "@/lib/db/outbox-repository";
import { getSyncCursor, setSyncCursor } from "@/lib/db/sync-state-repository";
import { syncReceiptsQueue } from "@/lib/receipts/queue";

import { applyPulledChangeToDb } from "./apply-pull";
import { buildPushBatch } from "./push-batch";
import { useSyncStateStore } from "./state-store";

const PUSH_BATCH_LIMIT = 200; // bem abaixo do MAX_PUSH_BATCH_SIZE (500) do backend
const MAX_PUSH_PAGES_PER_RUN = 50; // guarda contra loop infinito
const MAX_PULL_PAGES_PER_RUN = 50; // guarda contra loop infinito (espelha o teste do backend)
const SYNC_DEBOUNCE_MS = 1500; // "mesmo código em <1,5s" já é o padrão de debounce do app (scan)
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60_000;

function computeBackoffMs(attempts: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(exponential, MAX_BACKOFF_MS);
}

async function drainOutbox(): Promise<void> {
  const db = getDb();
  for (let page = 0; page < MAX_PUSH_PAGES_PER_RUN; page += 1) {
    const pending = listPendingOutbox(db, PUSH_BATCH_LIMIT);
    if (pending.length === 0) return;

    const batch = buildPushBatch(pending);
    const response = await pushSyncBatch(batch);
    const resultByClientId = new Map(response.results.map((result) => [result.clientId, result]));

    for (const row of pending) {
      const result = resultByClientId.get(row.client_id);
      if (!result) continue; // o backend sempre responde 1:1 por mutação enviada
      if (result.status === "applied" || result.status === "ignored_stale") {
        deleteOutboxRow(db, row.id);
        continue;
      }
      const nextAttemptAt = new Date(Date.now() + computeBackoffMs(row.attempts + 1)).toISOString();
      markOutboxAttemptFailed(db, row.id, result.reason ?? "rejeitado pelo servidor", nextAttemptAt);
    }

    if (pending.length < PUSH_BATCH_LIMIT) return; // essa foi a última página
  }
}

async function pullChanges(): Promise<void> {
  const db = getDb();
  let cursor = getSyncCursor(db);

  for (let page = 0; page < MAX_PULL_PAGES_PER_RUN; page += 1) {
    const response = await pullSyncChanges(cursor);
    for (const change of response.changes) {
      applyPulledChangeToDb(db, change);
    }
    cursor = response.nextCursor;
    setSyncCursor(db, cursor);
    if (!response.hasMore) return;
  }
}

let isRunning = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let engineInitialized = false;

/** Roda push + pull uma vez. Nunca lança — erro vira `status: "error"` no
 * state-store; quem chamou (debounce, NetInfo, AppState, botão manual) nunca
 * precisa de try/catch. */
export async function triggerSyncNow(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  const store = useSyncStateStore.getState();

  const netState = await NetInfo.fetch();
  if (netState.isConnected === false) {
    store.setStatus("offline");
    isRunning = false;
    return;
  }

  store.setStatus("syncing");
  try {
    await drainOutbox();
    await pullChanges();
    await syncReceiptsQueue(); // fila de notas (lib/receipts/queue.ts) — mesmos gatilhos, erro próprio
    store.setStatus("idle");
    store.setLastError(null);
    store.setLastSyncedAt(new Date().toISOString());
  } catch (error) {
    store.setStatus("error");
    store.setLastError(error instanceof Error ? error.message : "Falha ao sincronizar.");
  } finally {
    store.setPendingCount(countPendingOutbox(getDb()));
    isRunning = false;
  }
}

/** Debounce de ~1,5s após uma mutação local — várias edições seguidas (ex.:
 * ajustar quantidade repetidas vezes) disparam só uma sincronização. */
export function scheduleSyncSoon(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void triggerSyncNow();
  }, SYNC_DEBOUNCE_MS);
}

/** Chamado uma vez no bootstrap do app (`app/_layout.tsx`). Devolve uma função
 * de cleanup — idempotente, uma segunda chamada é no-op até a primeira ser
 * desmontada. */
export function initSyncEngine(): () => void {
  if (engineInitialized) return () => {};
  engineInitialized = true;

  useSyncStateStore.getState().setPendingCount(countPendingOutbox(getDb()));

  const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) void triggerSyncNow();
    else useSyncStateStore.getState().setStatus("offline");
  });

  const appStateSubscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") void triggerSyncNow();
  });

  void triggerSyncNow(); // 1ª tentativa ao abrir o app

  return () => {
    netInfoUnsubscribe();
    appStateSubscription.remove();
    engineInitialized = false;
  };
}
