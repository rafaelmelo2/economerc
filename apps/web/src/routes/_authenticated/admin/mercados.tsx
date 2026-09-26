import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LuPencil, LuPlus, LuStore } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { type DataListColumn, DataList } from "@/components/ui/data-list";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListToolbar } from "@/components/ui/list-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import {
  useCities,
  useCreateMarket,
  useUpdateMarket,
  type Market,
  type MarketUpsertPayload,
} from "@/lib/api/admin";

export const Route = createFileRoute("/_authenticated/admin/mercados")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: AdminMercadosPage,
});

interface MarketFormState {
  tradeName: string;
  legalName: string;
  cnpj: string;
  address: string;
  cityId: string;
}

function emptyForm(market: Market | null, fallbackCityId: string): MarketFormState {
  return {
    tradeName: market?.tradeName ?? "",
    legalName: market?.legalName ?? "",
    cnpj: market?.cnpj ?? "",
    address: market?.address ?? "",
    cityId: market?.cityId ?? fallbackCityId,
  };
}

function MarketFormDialog({
  open,
  onOpenChange,
  market,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market | null;
}) {
  const { data: cities } = useCities();
  const createMarket = useCreateMarket();
  const updateMarket = useUpdateMarket();
  const [form, setForm] = useState<MarketFormState>(emptyForm(market, cities?.[0]?.id ?? ""));

  const isPending = createMarket.isPending || updateMarket.isPending;

  const handleSubmit = () => {
    const payload: MarketUpsertPayload = {
      tradeName: form.tradeName,
      legalName: form.legalName || null,
      cnpj: form.cnpj || null,
      address: form.address || null,
      ...(market ? {} : { cityId: form.cityId }),
    };
    const onSuccess = () => onOpenChange(false);
    if (market) {
      updateMarket.mutate({ id: market.id, payload }, { onSuccess });
    } else {
      createMarket.mutate(payload, { onSuccess });
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setForm(emptyForm(market, cities?.[0]?.id ?? ""));
      }}
      title={market ? "Editar mercado" : "Novo mercado"}
      size="sm"
      footer={
        <Button onClick={handleSubmit} disabled={isPending || form.tradeName.trim().length === 0}>
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="market-name">Nome fantasia</Label>
          <Input
            id="market-name"
            value={form.tradeName}
            onChange={(event) => setForm((f) => ({ ...f, tradeName: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="market-legal-name">Razão social</Label>
          <Input
            id="market-legal-name"
            value={form.legalName}
            onChange={(event) => setForm((f) => ({ ...f, legalName: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="market-cnpj">CNPJ</Label>
          <Input
            id="market-cnpj"
            value={form.cnpj}
            onChange={(event) => setForm((f) => ({ ...f, cnpj: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="market-address">Endereço</Label>
          <Input
            id="market-address"
            value={form.address}
            onChange={(event) => setForm((f) => ({ ...f, address: event.target.value }))}
          />
        </div>
        {!market && (
          <div className="flex flex-col gap-1.5">
            <Label>Cidade</Label>
            <Select value={form.cityId} onValueChange={(next) => setForm((f) => ({ ...f, cityId: next }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cities?.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </FormDialog>
  );
}

function AdminMercadosPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [editing, setEditing] = useState<Market | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const list = useInfiniteList<Market>("/api/markets", { search: search.q });

  const columns: DataListColumn<Market>[] = [
    { id: "name", header: "Nome fantasia", role: "primary", cell: (m) => m.tradeName },
    { id: "cnpj", header: "CNPJ", role: "secondary", cell: (m) => m.cnpj ?? "—" },
    { id: "address", header: "Endereço", cell: (m) => m.address ?? "—" },
    { id: "partner", header: "Parceiro", cell: (m) => (m.isPartner ? "Sim" : "Não") },
  ];

  if (list.total === 0 && !list.isLoading && !search.q) {
    return (
      <div className="flex flex-col gap-4">
        <ListToolbar
          actions={
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <LuPlus /> Novo mercado
            </Button>
          }
        />
        <EmptyState
          icon={LuStore}
          title="Nenhum mercado cadastrado"
          description="Mercados de Catalão e região aparecem aqui — cadastre manualmente ou aguarde a primeira NFC-e casar pelo CNPJ."
        />
        <MarketFormDialog open={dialogOpen} onOpenChange={setDialogOpen} market={editing} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        search={search.q}
        onSearchChange={(next) => void navigate({ search: { q: next } })}
        searchPlaceholder="Buscar mercado…"
        actions={
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <LuPlus /> Novo mercado
          </Button>
        }
      />
      <DataList
        items={list.items}
        columns={columns}
        getRowId={(m) => m.id}
        actions={[
          {
            id: "edit",
            label: "Editar",
            icon: LuPencil,
            onSelect: (market) => {
              setEditing(market);
              setDialogOpen(true);
            },
          },
        ]}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        isFetchingNextPage={list.isFetchingNextPage}
        hasNextPage={list.hasNextPage}
        fetchNextPage={() => void list.fetchNextPage()}
        total={list.total}
        emptyTitle="Nenhum mercado encontrado"
      />
      <MarketFormDialog open={dialogOpen} onOpenChange={setDialogOpen} market={editing} />
    </div>
  );
}
