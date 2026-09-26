// Instância única do `ApiClient` (packages/shared) — access token em memória,
// refresh-on-401 delegado (rules/mobile.md > Auth). O handler de refresh é
// registrado por `lib/auth/refresh-lock.ts` em tempo de bootstrap: evita import
// circular (o refresh também usa este client pra chamar `/auth/refresh`).

import { type ApiClient, createApiClient } from "@economerc/shared";

import { getAccessToken } from "@/lib/auth/token-store";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8010/api";

type UnauthorizedHandler = () => Promise<string | null>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

export const apiClient: ApiClient = createApiClient(API_BASE_URL, {
  getToken: getAccessToken,
  onUnauthorized: async () => (unauthorizedHandler ? unauthorizedHandler() : null),
});
