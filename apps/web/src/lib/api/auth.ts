import type { AuthUser } from "@/stores/auth";

/**
 * Chamadas cruas a `/api/auth/*` — fora do `ApiClient` genérico de propósito: precisam do header
 * `X-Client: web` (ativa o modo cookie HttpOnly do refresh no backend) e `credentials: "include"`
 * (manda/recebe o cookie). Nunca usadas fora deste módulo (skill `auth`).
 */

const WEB_CLIENT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "X-Client": "web",
};

interface RawUserResponse {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  user: RawUserResponse;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

function toAuthUser(raw: RawUserResponse): AuthUser {
  return {
    id: raw.id,
    email: raw.email ?? "",
    name: raw.display_name ?? raw.email ?? "Usuário",
    role: (raw.role as AuthUser["role"]) ?? "user",
  };
}

async function parseTokenResponse(response: Response): Promise<AuthSession | null> {
  if (!response.ok) return null;
  const body = (await response.json()) as RawTokenResponse;
  return { accessToken: body.access_token, user: toAuthUser(body.user) };
}

/** `credential` = id_token do Google Identity Services (`GoogleLogin`, não o popup auth-code). */
export async function loginWithGoogle(idToken: string): Promise<AuthSession | null> {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    headers: WEB_CLIENT_HEADERS,
    credentials: "include",
    body: JSON.stringify({ id_token: idToken }),
  });
  return parseTokenResponse(response);
}

/** Login "Entrar (dev)" — só quando `POST /api/auth/dev-login` existir e em `import.meta.env.DEV`. */
export async function loginWithDevBackdoor(email: string): Promise<AuthSession | null> {
  const response = await fetch("/api/auth/dev-login", {
    method: "POST",
    headers: WEB_CLIENT_HEADERS,
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  return parseTokenResponse(response);
}

/** Sem `Authorization`: o refresh vem do cookie HttpOnly, o browser manda sozinho. */
export async function refreshSession(): Promise<AuthSession | null> {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: WEB_CLIENT_HEADERS,
    credentials: "include",
  });
  return parseTokenResponse(response);
}

/** Best-effort — nunca lança. Login e logout sempre seguem mesmo se isto falhar. */
export async function endServerSession(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: WEB_CLIENT_HEADERS,
      credentials: "include",
    });
  } catch {
    // rede caiu — o cookie expira sozinho, não é motivo pra travar o logout do usuário.
  }
}
