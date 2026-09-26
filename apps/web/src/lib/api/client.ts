import { createApiClient, type ApiClient, type ApiResponse } from "@economerc/shared";

import { refreshSession } from "@/lib/api/auth";
import { withRefreshLock } from "@/lib/auth/refresh-lock";
import { getAccessToken, useAuthStore } from "@/stores/auth";

const AUTH_ROUTE_PREFIX = "/api/auth/";

function isAuthRoute(path: string): boolean {
  return path.startsWith(AUTH_ROUTE_PREFIX);
}

/**
 * Refresh on 401 (skill `auth` §11) — o guard é o SNAPSHOT pré-lock, nunca "já existe token"
 * (o expirado também é truthy). Quem espera o lock e vê o token já ter mudado não repete a
 * rotação: outro caller já trouxe o par novo.
 */
async function handleTokenRefresh(): Promise<boolean> {
  const tokenBeforeLock = getAccessToken();
  return withRefreshLock(async () => {
    const current = getAccessToken();
    if (current && current !== tokenBeforeLock) return true;

    const session = await refreshSession();
    if (!session) {
      useAuthStore.getState().clear();
      return false;
    }
    useAuthStore.getState().setSession(session);
    return true;
  });
}

const rawClient = createApiClient(
  typeof window !== "undefined" ? window.location.origin : "http://localhost",
  // O retry de 401 é o `withRetry` abaixo (lock da web); não usar `onUnauthorized` aqui
  // para não renovar duas vezes.
  { getToken: getAccessToken },
);

async function withRetry<T>(
  path: string,
  call: () => Promise<ApiResponse<T>>,
): Promise<ApiResponse<T>> {
  const first = await call();
  if (first.status !== 401 || isAuthRoute(path)) return first;
  const refreshed = await handleTokenRefresh();
  if (!refreshed) return first;
  return call();
}

/** Cliente único da app — TODA chamada a endpoint próprio passa por aqui (nunca `fetch` cru,
 * fora de `lib/api/auth.ts`), pra ganhar o retry de 401 acima. */
export const apiClient: ApiClient = {
  get: (path, searchParams) => withRetry(path, () => rawClient.get(path, searchParams)),
  post: (path, body) => withRetry(path, () => rawClient.post(path, body)),
  patch: (path, body) => withRetry(path, () => rawClient.patch(path, body)),
  delete: (path) => withRetry(path, () => rawClient.delete(path)),
};
