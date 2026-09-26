import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { routeTree } from "@/routeTree.gen";
import "@/index.css";
// Aplica o tema (data-theme) assim que o módulo carrega — evita flash claro/escuro.
import "@/stores/theme";

// Preload mínimo pra navegação instantânea entre as poucas rotas da web-resumo, sem virar
// request storm no hover (ver .claude/rules/web.md > TanStack Router).
const DEFAULT_PRELOAD_STALE_TIME_MS = 60_000;

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

const rootElement = document.getElementById("app");
if (!rootElement) {
  throw new Error("Elemento #app não encontrado em index.html");
}

if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
