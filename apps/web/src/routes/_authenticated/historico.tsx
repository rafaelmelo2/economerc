import { createFileRoute } from "@tanstack/react-router";
import { LuHistory } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/historico")({
  component: HistoricoPage,
});

function HistoricoPage() {
  return (
    <EmptyState
      icon={LuHistory}
      title="Sua primeira compra aparece aqui"
      description="Escaneie os produtos no app ou leia a nota fiscal no fim da compra. O histórico e os gráficos por categoria aparecem aqui assim que a primeira compra chegar."
    />
  );
}
