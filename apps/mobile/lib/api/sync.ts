// `POST /sync/push` / `GET /sync/pull` — wrapper tipado sobre o `ApiClient`
// (rules/mobile.md > outbox/pull). O motor de sync (`lib/sync/engine.ts`) é o
// único chamador.

import {
  type SyncPullResponse,
  syncPullResponseSchema,
  type SyncPushResponse,
  syncPushResponseSchema,
} from "@economerc/shared";

import type { OutboxMutationPayload } from "@/lib/sync/push-batch";

import { apiClient } from "./client";
import { ApiRequestError } from "./errors";

const PULL_PAGE_LIMIT = 200;

export async function pushSyncBatch(
  mutations: readonly OutboxMutationPayload[],
): Promise<SyncPushResponse> {
  const res = await apiClient.post<unknown>("/sync/push", { mutations });
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  return syncPushResponseSchema.parse(res.data);
}

export async function pullSyncChanges(cursor: string | null): Promise<SyncPullResponse> {
  const res = await apiClient.get<unknown>("/sync/pull", {
    cursor: cursor ?? undefined,
    limit: PULL_PAGE_LIMIT,
  });
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  return syncPullResponseSchema.parse(res.data);
}
