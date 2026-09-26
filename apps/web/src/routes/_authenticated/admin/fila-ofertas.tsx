import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { LuCheck, LuListChecks, LuLoader, LuPlay, LuX } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EntityPicker } from "@/components/ui/entity-picker";
import { FormDialog } from "@/components/ui/form-dialog";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { makeEntityListHook } from "@/hooks/useEntityList";
import {
  useApproveOfferCandidate,
  useRejectOfferCandidate,
  useRunSupercatalaoCollector,
  type OfferCandidate,
  type Product,
} from "@/lib/api/admin";
import { formatMoneyFromApi } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/admin/fila-ofertas")({
  component: AdminFilaOfertasPage,
});

const useProductsPicker = makeEntityListHook<Product>("/api/products");

function ApproveDialog({
  candidate,
  onOpenChange,
}: {
  candidate: OfferCandidate | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [productId, setProductId] = useState<string | null>(null);
  const approve = useApproveOfferCandidate();

  return (
    <FormDialog
      open={candidate !== null}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setProductId(null);
      }}
      title="Aprovar oferta"
      description={candidate?.productName}
      size="sm"
      footer={
        <Button
          disabled={!productId || approve.isPending}
          onClick={() => {
            if (!candidate || !productId) return;
            approve.mutate(
              { id: candidate.id, productId },
              {
                onSuccess: () => {
                  toast.success("Oferta aprovada.");
                  onOpenChange(false);
                  setProductId(null);
                },
                onError: () => toast.error("Não foi possível aprovar esta oferta."),
              },
            );
          }}
        >
          {approve.isPending ? "Aprovando…" : "Aprovar"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Escolha a qual produto do catálogo esta oferta corresponde.
        </p>
        <EntityPicker
          useList={useProductsPicker}
          value={productId}
          onChange={(id) => setProductId(id)}
          getId={(p) => p.id}
          getLabel={(p) => p.name}
          placeholder="Escolher produto…"
          searchPlaceholder="Buscar produto…"
          emptyText="Nenhum produto encontrado"
        />
      </div>
    </FormDialog>
  );
}

function OfferCard({
  candidate,
  onApprove,
  onReject,
}: {
  candidate: OfferCandidate;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{candidate.productName}</p>
          <p className="text-xs text-muted-foreground">{candidate.source}</p>
        </div>
        <Badge variant="secondary">{formatMoneyFromApi(candidate.priceAmount)}</Badge>
      </div>
      {candidate.rawText && (
        <p className="rounded-md bg-muted p-2 text-xs whitespace-pre-wrap break-all text-muted-foreground">
          {candidate.rawText}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onReject}>
          <LuX className="size-4" /> Rejeitar
        </Button>
        <Button size="sm" onClick={onApprove}>
          <LuCheck className="size-4" /> Aprovar
        </Button>
      </div>
    </div>
  );
}

function CollectorRunner() {
  const run = useRunSupercatalaoCollector();

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">Coletor do Supermercado Catalão</p>
        <p className="text-xs text-muted-foreground">
          Roda o crawler do site na hora e joga os itens encontrados nesta fila.
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Button
          variant="outline"
          disabled={run.isPending}
          onClick={() =>
            run.mutate(undefined, {
              onSuccess: (result) =>
                toast.success(
                  `Coletor concluído: ${result.itemsFound} itens encontrados, ${result.pricesCreated} preços criados.`,
                ),
              onError: () => toast.error("O coletor falhou. Veja os logs do backend."),
            })
          }
        >
          {run.isPending ? <LuLoader className="size-4 animate-spin" /> : <LuPlay className="size-4" />}
          Rodar coletor
        </Button>
        {run.data && (
          <p className="text-xs text-muted-foreground">
            Última execução: {run.data.status} — {run.data.itemsFound} itens, {run.data.pricesCreated} preços.
          </p>
        )}
      </div>
    </div>
  );
}

function AdminFilaOfertasPage() {
  const list = useInfiniteList<OfferCandidate>("/api/admin/offer-candidates", { status: "pending" });
  const [approving, setApproving] = useState<OfferCandidate | null>(null);
  const [rejecting, setRejecting] = useState<OfferCandidate | null>(null);
  const reject = useRejectOfferCandidate();

  return (
    <div className="flex flex-col gap-4">
      <CollectorRunner />

      {list.total === 0 && !list.isLoading ? (
        <EmptyState
          icon={LuListChecks}
          title="Fila de ofertas vazia"
          description="Ofertas capturadas pelo coletor do site ou pelo WhatsApp aparecem aqui para revisão antes de virarem preço no catálogo."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.items.map((candidate) => (
              <OfferCard
                key={candidate.id}
                candidate={candidate}
                onApprove={() => setApproving(candidate)}
                onReject={() => setRejecting(candidate)}
              />
            ))}
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {list.items.length} de {list.total}
            </p>
            {list.hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
              </Button>
            )}
          </div>
        </>
      )}

      <ApproveDialog candidate={approving} onOpenChange={(open) => !open && setApproving(null)} />
      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title="Rejeitar oferta?"
        description={rejecting ? `"${rejecting.productName}" sai da fila e não vira preço.` : undefined}
        confirmLabel="Rejeitar"
        destructive
        busy={reject.isPending}
        onConfirm={() => {
          if (!rejecting) return;
          reject.mutate(rejecting.id, {
            onSuccess: () => {
              toast.success("Oferta rejeitada.");
              setRejecting(null);
            },
          });
        }}
      />
    </div>
  );
}
