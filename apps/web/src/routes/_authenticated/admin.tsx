import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LuShieldAlert } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";
import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

/** Portão do painel admin — quem não é `role=admin` vê um 403 amigável, sem sair da casca
 * autenticada (nada de redirect silencioso: fica claro que a área existe e é restrita). */
function AdminLayout() {
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");

  if (!isAdmin) {
    return (
      <EmptyState
        icon={LuShieldAlert}
        title="Esta área é só para a equipe"
        description="O painel admin é restrito a quem modera preços, produtos e mercados do EconoMerc. Se você acha que deveria ter acesso, fale com o time."
      />
    );
  }

  return <Outlet />;
}
