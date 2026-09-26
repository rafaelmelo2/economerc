import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { FaApple } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/entrar")({
  beforeLoad: () => {
    if (useAuthStore.getState().accessToken) {
      throw redirect({ to: "/historico" });
    }
  },
  component: LoginPage,
});

// Sessão mock — sem integração OAuth ainda. TODO onda 5: auth real (Google + Apple via JWKS,
// access token em memória, refresh em cookie HttpOnly — ver skill `auth`).
function createMockSession() {
  useAuthStore.getState().setSession({
    accessToken: "mock-access-token",
    user: { name: "Ana Compradora", email: "ana@exemplo.com.br" },
  });
}

function LoginPage() {
  const navigate = useNavigate();

  const handleMockLogin = () => {
    // TODO onda 5: auth real — troca o popup/token real pelo backend, nunca aceitar
    // id_token do front sem reverificar (ver skill auth).
    createMockSession();
    navigate({ to: "/historico" });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/simbolo.svg" alt="" className="size-12" />
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-bold">Entrar no EconoMerc</h1>
            <p className="text-sm text-muted-foreground">
              Seu histórico e as ofertas da região ficam aqui, sempre que você quiser conferir.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm">
          <Button type="button" variant="outline" size="lg" onClick={handleMockLogin}>
            <FcGoogle />
            Continuar com Google
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={handleMockLogin}>
            <FaApple />
            Continuar com Apple
          </Button>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Sem e-mail e senha por enquanto — só Google ou Apple.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          O controle de verdade é no app. Aqui é só o resumo.
        </p>
      </div>
    </div>
  );
}
