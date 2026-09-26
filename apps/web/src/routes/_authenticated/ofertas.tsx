import { createFileRoute } from "@tanstack/react-router";
import { LuTag } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/ofertas")({
  component: OfertasPage,
});

function OfertasPage() {
  return (
    <EmptyState
      icon={LuTag}
      title="Ainda não temos ofertas na sua região"
      description="Viu um preço bom pelo app? Conta pra gente — o mural de ofertas de Catalão-GO aparece aqui na Fase 2."
    />
  );
}
