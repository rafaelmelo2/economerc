import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { endServerSession, loginWithGoogle, refreshSession } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth";

/** Sessão em background: revalida depois de ~60s longe da aba (iOS congela a WebView do PWA
 * instalado) em vez de esperar o próximo 401 — troca rápida de aba não paga esse custo. */
const RESUME_REVALIDATE_AFTER_MS = 60_000;

/**
 * Composition hook fino sobre o `useAuthStore` (zustand) — NUNCA um Context provider.
 * `beforeLoad` (fora do React) lê `useAuthStore.getState()` diretamente.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const queryClient = useQueryClient();

  const googleLogin = useMutation({
    mutationFn: async (idToken: string) => {
      // Login = reset total (skill `auth` §12b) — limpa ANTES de chamar, não no onSuccess.
      useAuthStore.setState({ accessToken: null, user: null });
      queryClient.clear();
      await endServerSession(); // revoga a sessão anterior no servidor — best-effort.
      const session = await loginWithGoogle(idToken);
      if (!session) throw new Error("Não foi possível entrar com o Google.");
      return session;
    },
    onSuccess: (session) => useAuthStore.getState().setSession(session),
    onError: () => useAuthStore.setState({ accessToken: null, user: null, status: "anonymous" }),
  });

  const logout = useCallback(() => {
    useAuthStore.getState().clear();
    queryClient.clear();
    void endServerSession();
  }, [queryClient]);

  return {
    user,
    isAuthenticated: status === "authenticated",
    isPending: status === "pending",
    isAdmin: user?.role === "admin",
    loginWithGoogle: googleLogin.mutateAsync,
    loginError: googleLogin.error,
    isLoggingIn: googleLogin.isPending,
    logout,
  };
}

/** Bootstrap gate (skill `auth` §10) — decide a sessão ANTES do router montar. Usa o cookie
 * HttpOnly de refresh direto (sem round-trip extra em `/me`): sessão válida → cookie rotaciona
 * e devolve o par novo; sem cookie/expirado → 401, vira "anonymous". */
export function useAuthBootstrap() {
  useEffect(() => {
    let cancelled = false;
    void refreshSession()
      .then((session) => {
        if (cancelled) return;
        if (session) useAuthStore.getState().setSession(session);
        else useAuthStore.setState({ status: "anonymous" });
      })
      .catch(() => {
        if (!cancelled) useAuthStore.setState({ status: "anonymous" });
      });
    return () => {
      cancelled = true;
    };
  }, []);
}

/** Resume de background — só 401 encerra a sessão; falha de rede a preserva (skill `auth` §10). */
export function useAuthResumeRevalidation() {
  const hiddenAt = useRef(0);

  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        return;
      }
      const elapsed = Date.now() - hiddenAt.current;
      hiddenAt.current = 0;
      if (!elapsed || elapsed < RESUME_REVALIDATE_AFTER_MS) return;
      if (useAuthStore.getState().status !== "authenticated") return;

      refreshSession()
        .then((session) => {
          if (session) useAuthStore.getState().setSession(session);
          else useAuthStore.getState().clear(); // 401 de verdade — sessão revogada/expirada.
        })
        .catch(() => {
          // Rede caiu — mantém quem já estava logado, nunca desloga por causa disso.
        });
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}
