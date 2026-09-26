import { createFileRoute } from "@tanstack/react-router";
import { LuDollarSign } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/admin/precos")({
  component: AdminPrecosPage,
});

function AdminPrecosPage() {
  return (
    <EmptyState
      icon={LuDollarSign}
      title="Nenhum preço para revisar"
      description="Preços com mais de 15 dias sem confirmação, ou reportados pela comunidade fora da curva, caem aqui para moderação."
    />
  );
}
