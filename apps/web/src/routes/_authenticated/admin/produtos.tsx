import { createFileRoute } from "@tanstack/react-router";
import { LuBox } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: AdminProdutosPage,
});

function AdminProdutosPage() {
  return (
    <EmptyState
      icon={LuBox}
      title="Nenhum produto para moderar"
      description="Produtos cadastrados pelo app, por NFC-e ou pela comunidade aparecem aqui para revisão — nome, categoria e código de barras."
    />
  );
}
