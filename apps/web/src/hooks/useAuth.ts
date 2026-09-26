import { useAuthStore } from "@/stores/auth";

/**
 * Composition hook fino sobre o `useAuthStore` (zustand) — NUNCA um Context provider.
 * `beforeLoad` (fora do React) lê `useAuthStore.getState()` diretamente.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const clear = useAuthStore((s) => s.clear);

  return {
    user,
    isAuthenticated: !!accessToken,
    logout: clear,
  };
}
