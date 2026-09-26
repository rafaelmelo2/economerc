import { createFileRoute } from "@tanstack/react-router";
import { LuFileWarning } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/admin/notas")({
  component: AdminNotasPage,
});

function AdminNotasPage() {
  return (
    <EmptyState
      icon={LuFileWarning}
      title="Nenhuma nota com falha"
      description="Notas fiscais que a consulta da SEFAZ não conseguiu ler de primeira ficam aqui, com o motivo, até serem reprocessadas."
    />
  );
}
