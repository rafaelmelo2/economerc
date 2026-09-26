import { GoogleLogin } from "@react-oauth/google";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FaApple } from "react-icons/fa6";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { loginWithDevBackdoor } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth";

// Sem client ID o Google abre um popup que só diz "Missing required parameter: client_id".
const IS_GOOGLE_CONFIGURED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export const Route = createFileRoute("/entrar")({
  beforeLoad: () => {
    if (useAuthStore.getState().status === "authenticated") {
      throw redirect({ to: "/historico" });
    }
  },
  component: LoginPage,
});

/** Botão "Entrar (dev)" só existe quando a rota realmente existe no backend (outro agente pode
 * ainda não ter subido `POST /api/auth/dev-login`) — checagem única, cacheada no módulo. */
function useDevLoginAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    fetch("/api/openapi.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((spec: { paths?: Record<string, unknown> } | null) => {
        if (!cancelled && spec?.paths && "/api/auth/dev-login" in spec.paths) {
          setAvailable(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return available;
}

function LoginPage() {
  const navigate = useNavigate();
  const { loginWithGoogle, loginError, isLoggingIn } = useAuth();
  const devLoginAvailable = useDevLoginAvailable();

  const handleGoogleSuccess = async (credential: string) => {
    await loginWithGoogle(credential);
    navigate({ to: "/historico" });
  };

  const handleDevLogin = async () => {
    const session = await loginWithDevBackdoor("rafinhalelograma@hotmail.com");
    if (session) {
      useAuthStore.getState().setSession(session);
      navigate({ to: "/historico" });
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/simbolo.svg" alt="" className="size-12" />
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-bold">
              Entrar no EconoMerc
            </h1>
            <p className="text-sm text-muted-foreground">
              Seu histórico e as ofertas da região ficam aqui, sempre que você
              quiser conferir.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex justify-center">
            {IS_GOOGLE_CONFIGURED ? (
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  if (credentialResponse.credential) {
                    void handleGoogleSuccess(credentialResponse.credential);
                  }
                }}
                text="continue_with"
                width={280}
              />
            ) : (
              <p
                role="alert"
                className="text-center text-sm text-muted-foreground"
              >
                Login com Google indisponível: falta o{" "}
                <code>VITE_GOOGLE_CLIENT_ID</code> em{" "}
                <code>apps/web/.env.local</code> (reinicie o{" "}
                <code>bun run dev</code> depois).
              </p>
            )}
          </div>
          <Button type="button" variant="outline" size="lg" disabled>
            <FaApple />
            Continuar com Apple
          </Button>
          {isLoggingIn && (
            <p className="text-center text-xs text-muted-foreground">
              Entrando…
            </p>
          )}
          {loginError && (
            <p className="text-center text-xs text-destructive">
              Não foi possível entrar. Tente novamente.
            </p>
          )}
          {devLoginAvailable && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleDevLogin()}
            >
              Entrar (dev)
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          O controle de verdade é no app. Aqui é só o resumo.
        </p>
      </div>
    </div>
  );
}
