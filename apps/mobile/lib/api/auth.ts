// `POST /auth/{google,apple,dev-login,refresh,logout}` (skill `auth`,
// rules/mobile.md > Login). Cada função valida a resposta com o schema Zod de
// `packages/shared` antes de devolver — nunca confia em `unknown` cru.

import { type JsonValue, type TokenResponse, tokenResponseSchema } from "@economerc/shared";

import { apiClient } from "./client";
import { ApiRequestError } from "./errors";

async function postAuth(path: string, body: Record<string, JsonValue>): Promise<TokenResponse> {
  const res = await apiClient.post<unknown>(path, body);
  if (!res.success) throw new ApiRequestError(res.status, res.data);
  return tokenResponseSchema.parse(res.data);
}

export function loginWithGoogle(idToken: string): Promise<TokenResponse> {
  return postAuth("/auth/google", { idToken });
}

export function loginWithApple(identityToken: string, fullName: string | null): Promise<TokenResponse> {
  return postAuth("/auth/apple", { identityToken, fullName });
}

/** Botão "Entrar (dev)" — só existe com `__DEV__` (a rota some fora de
 * `ENVIRONMENT=local` no backend; em prod isso daria 404, nunca deveria ser
 * chamado). */
export function loginDev(): Promise<TokenResponse> {
  return postAuth("/auth/dev-login", {});
}

export function refreshSession(refreshToken: string): Promise<TokenResponse> {
  return postAuth("/auth/refresh", { refreshToken });
}

export async function logoutSession(refreshToken: string): Promise<void> {
  // Best-effort — logout local nunca deve travar esperando o servidor.
  try {
    await apiClient.post("/auth/logout", { refreshToken });
  } catch {
    // Rede fora do ar não impede o logout local (rules/mobile.md > nunca
    // bloquear UI esperando rede).
  }
}
