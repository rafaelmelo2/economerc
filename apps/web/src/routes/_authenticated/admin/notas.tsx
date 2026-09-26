import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LuFileWarning, LuRotateCcw } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";
import { type DataListColumn, DataList } from "@/components/ui/data-list";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useRetryReceipt, type AdminReceipt } from "@/lib/api/admin";

export const Route = createFileRoute("/_authenticated/admin/notas")({
  component: AdminNotasPage,
});

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function AdminNotasPage() {
  const list = useInfiniteList<AdminReceipt>("/api/admin/receipts", { status: "failed" });
  const retry = useRetryReceipt();

  const columns: DataListColumn<AdminReceipt>[] = [
    { id: "user", header: "Usuário", role: "primary", cell: (r) => r.userEmail ?? "—" },
    { id: "market", header: "Mercado", role: "secondary", cell: (r) => r.marketName ?? "—" },
    { id: "reason", header: "Motivo da falha", cell: (r) => r.failureReason ?? "—" },
    { id: "attempts", header: "Tentativas", cell: (r) => r.attempts },
    { id: "created", header: "Recebida em", cell: (r) => formatDate(r.createdAt) },
  ];

  if (list.total === 0 && !list.isLoading) {
    return (
      <EmptyState
        icon={LuFileWarning}
        title="Nenhuma nota com falha"
        description="Notas fiscais que o worker não conseguiu processar (SEFAZ fora do ar, QR inválido, timeout) aparecem aqui para reprocessamento manual."
      />
    );
  }

  return (
    <DataList
      items={list.items}
      columns={columns}
      getRowId={(r) => r.id}
      actions={[
        {
          id: "retry",
          label: "Reprocessar",
          icon: LuRotateCcw,
          onSelect: (receipt) =>
            retry.mutate(receipt.id, {
              onSuccess: () => toast.success("Nota reenviada para reprocessamento."),
              onError: () => toast.error("Não foi possível reprocessar esta nota."),
            }),
        },
      ]}
      isLoading={list.isLoading}
      isFetching={list.isFetching}
      isFetchingNextPage={list.isFetchingNextPage}
      hasNextPage={list.hasNextPage}
      fetchNextPage={() => void list.fetchNextPage()}
      total={list.total}
      emptyTitle="Nenhuma nota com falha"
    />
  );
}
