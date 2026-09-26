import { createFileRoute } from "@tanstack/react-router";
import { LuStore } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/admin/mercados")({
  component: AdminMercadosPage,
});

function AdminMercadosPage() {
  return (
    <EmptyState
      icon={LuStore}
      title="Nenhum mercado cadastrado ainda"
      description="Os mercados de Catalão-GO aparecem aqui assim que o CNPJ do emitente for lido na primeira NFC-e ou cadastrado manualmente."
    />
  );
}
