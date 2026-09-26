import { createFileRoute } from "@tanstack/react-router";
import { LuListChecks } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/admin/fila-ofertas")({
  component: AdminFilaOfertasPage,
});

function AdminFilaOfertasPage() {
  return (
    <EmptyState
      icon={LuListChecks}
      title="Fila de ofertas vazia"
      description="Ofertas reportadas pela comunidade ou capturadas pelo coletor esperam aqui aprovação antes de entrar no mural (Fase 2)."
    />
  );
}
