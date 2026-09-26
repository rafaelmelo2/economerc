import { create } from "zustand";

/**
 * Store de autenticação real (bloco 5B, skill `auth`). Access token SÓ em memória — NUNCA
 * persist (XSS = jogo perdido se o access vive em storage acessível). `beforeLoad` (fora do
 * React) e o `useAuth()` leem daqui. Refresh token nunca aparece aqui: vive em cookie HttpOnly,
 * o browser manda sozinho em toda chamada `credentials: "include"`.
 */

export type AuthStatus = "pending" | "authenticated" | "anonymous";
export type UserRole = "user" | "moderator" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (session: { accessToken: string; user: AuthUser }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "pending",
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => set({ accessToken, user, status: "authenticated" }),
  clear: () => set({ accessToken: null, user: null, status: "anonymous" }),
}));

/** Snapshot síncrono — usado pelo `ApiClient`/refresh interceptor (fora de componente React). */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}
