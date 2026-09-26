// Renovação de sessão com lock (rules/web.md > Auth, adaptado pro RN: sem Web
// Locks API, o lock é uma promise módulo-level compartilhada — mesma garantia
// de "uma renovação por vez"). Todo caller (interceptor 401 do `ApiClient` E o
// bootstrap do app) disputa o MESMO `inFlight`.

import type { TokenResponse } from "@economerc/shared";

import { refreshSession } from "@/lib/api/auth";
import { registerUnauthorizedHandler } from "@/lib/api/client";

import {
  clearInMemoryAccessToken,
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setAccessToken,
  setStoredRefreshToken,
} from "./token-store";

type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

/** `session-store.ts` registra isso pra saber quando forçar logout local (refresh
 * token revogado/expirado do lado do servidor). */
export function registerSessionExpiredHandler(handler: SessionExpiredHandler): void {
  onSessionExpired = handler;
}

let inFlight: Promise<TokenResponse | null> | null = null;

async function performRefresh(): Promise<TokenResponse | null> {
  const stored = await getStoredRefreshToken();
  if (!stored) return null;

  try {
    const pair = await refreshSession(stored);
    setAccessToken(pair.accessToken);
    if (pair.refreshToken) await setStoredRefreshToken(pair.refreshToken);
    return pair;
  } catch {
    await clearStoredRefreshToken();
    clearInMemoryAccessToken();
    onSessionExpired?.();
    return null;
  }
}

export function refreshSessionOnce(): Promise<TokenResponse | null> {
  if (!inFlight) {
    inFlight = performRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

registerUnauthorizedHandler(async () => {
  const pair = await refreshSessionOnce();
  return pair?.accessToken ?? null;
});
