import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useAuthBootstrap, useAuthResumeRevalidation } from "@/hooks/useAuth";
import { routeTree } from "@/routeTree.gen";
import { useAuthStore } from "@/stores/auth";
import "@/index.css";
// Aplica o tema (data-theme) assim que o módulo carrega — evita flash claro/escuro.
import "@/stores/theme";

// Preload mínimo pra navegação instantânea entre as poucas rotas da web-resumo, sem virar
// request storm no hover (ver .claude/rules/web.md > TanStack Router).
const DEFAULT_PRELOAD_STALE_TIME_MS = 60_000;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  defaultPreloadStaleTime: DEFAULT_PRELOAD_STALE_TIME_MS,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

/** O router só monta DEPOIS que o bootstrap decidir a sessão (skill `auth` §10) — router
 * montado antes é o que manda usuário já logado pro `/entrar` numa rede lenta. */
function AppGate() {
  useAuthBootstrap();
  useAuthResumeRevalidation();
  const status = useAuthStore((s) => s.status);

  if (status === "pending") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <img src="/simbolo.svg" alt="" className="size-10 animate-pulse" />
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

const rootElement = document.getElementById("app");
if (!rootElement) {
  throw new Error("Elemento #app não encontrado em index.html");
}

if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AppGate />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </StrictMode>,
  );
}
