import { Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Layout dono da largura/enquadramento da casca autenticada (gate `frontend` > item 1).
 * O cap de 1440 é freio de telas 2K/4K; o gutter fluido é quem o usuário sente abaixo disso.
 */
const CONTENT_MAX_W = "max-w-[1440px]";
const CONTENT_PX = "px-[clamp(1rem,2vw,2rem)]";

const PAGE_TITLES: Record<string, string> = {
  "/historico": "Histórico",
  "/ofertas": "Ofertas",
  "/admin/produtos": "Produtos",
  "/admin/mercados": "Mercados",
  "/admin/precos": "Preços",
  "/admin/notas": "Notas com falha",
  "/admin/fila-ofertas": "Fila de ofertas",
};

function usePageTitle(): string {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return PAGE_TITLES[pathname] ?? "EconoMerc";
}

interface SidebarLayoutProps {
  children?: ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const title = usePageTitle();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className={`mx-auto flex w-full ${CONTENT_MAX_W} items-center justify-between ${CONTENT_PX}`}>
            <div className="flex flex-1 items-center gap-3">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <h1 className="text-base leading-none font-bold tracking-tight">{title}</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className={`mx-auto w-full ${CONTENT_MAX_W} ${CONTENT_PX} py-6 md:py-8`}>
            {children ?? <Outlet />}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
