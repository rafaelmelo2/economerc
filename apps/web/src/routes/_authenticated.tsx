import { createFileRoute, redirect } from "@tanstack/react-router";

import { SidebarLayout } from "@/components/layouts/sidebar-layout";
import { useAuthStore } from "@/stores/auth";

// Guard ÚNICO da casca autenticada. SÍNCRONO — lê o store fora do React, zero await/fetch
// (ver .claude/rules/web.md > TanStack Router).
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    if (useAuthStore.getState().status !== "authenticated") {
      throw redirect({ to: "/entrar" });
    }
  },
  component: SidebarLayout,
});
