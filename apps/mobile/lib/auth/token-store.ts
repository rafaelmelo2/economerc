// Access token em memória (NUNCA AsyncStorage/SecureStore — rules/mobile.md >
// Auth). Refresh token só em expo-secure-store. Módulo sem estado de React —
// lido/escrito tanto pelo `ApiClient` (packages/shared) quanto pelo
// refresh-lock e pelo session-store.

import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "economerc.refreshToken";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setStoredRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearStoredRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

/** Logout/reset local — nunca falha (best-effort), quem chama decide o que
 * fazer com o resultado do lado do servidor separadamente. */
export function clearInMemoryAccessToken(): void {
  accessToken = null;
}
