import { create } from "zustand";

/**
 * Store MOCK de autenticação — onda 1C só monta a casca. `beforeLoad` (fora do React) e o
 * `useAuth()` leem daqui. Sem persist: sessão mock não sobrevive a um F5, de propósito.
 * TODO onda 5: substituir por auth real (Google/Apple, access em memória + refresh em cookie
 * HttpOnly — ver skill `auth`).
 */

export interface AuthUser {
  name: string;
  email: string;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (session: { accessToken: string; user: AuthUser }) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
}));
