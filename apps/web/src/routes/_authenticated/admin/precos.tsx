import { createFileRoute } from "@tanstack/react-router";
import { LuDollarSign } from "react-icons/lu";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { type DataListColumn, DataList } from "@/components/ui/data-list";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ListToolbar } from "@/components/ui/list-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { makeEntityListHook } from "@/hooks/useEntityList";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import type { Market, Product } from "@/lib/api/admin";
import type { AdminPrice } from "@/lib/api/admin";
import { formatMoneyFromApi } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/admin/precos")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { marketId?: string; productId?: string; source?: string; staleOnly?: boolean } => ({
    marketId: typeof search.marketId === "string" ? search.marketId : undefined,
    productId: typeof search.productId === "string" ? search.productId : undefined,
    source: typeof search.source === "string" ? search.source : undefined,
    staleOnly: search.staleOnly === true,
  }),
  component: AdminPrecosPage,
});

const PRICE_SOURCES = ["nfce", "community", "flyer", "manual", "partner", "scraper"] as const;

const useProductsPicker = makeEntityListHook<Product>("/api/products");
const useMarketsPicker = makeEntityListHook<Market>("/api/markets");

function formatObservedAt(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

function AdminPrecosPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const list = useInfiniteList<AdminPrice>("/api/admin/prices", {
    marketId: search.marketId,
    productId: search.productId,
    source: search.source,
    staleOnly: search.staleOnly,
  });

  const activeFilterCount = [search.marketId, search.productId, search.source, search.staleOnly].filter(
    Boolean,
  ).length;

  const columns: DataListColumn<AdminPrice>[] = [
    { id: "product", header: "Produto", role: "primary", cell: (p) => p.productName },
    { id: "market", header: "Mercado", role: "secondary", cell: (p) => p.marketName },
    {
      id: "amount",
      header: "Preço",
      cell: (p) => <span className="num">{formatMoneyFromApi(p.amount)}</span>,
    },
    { id: "source", header: "Fonte", cell: (p) => p.source },
    {
      id: "observed",
      header: "Observado em",
      cell: (p) => formatObservedAt(p.observedAt),
    },
    {
      id: "stale",
      header: "Status",
      role: "badge",
      cell: (p) =>
        p.isStale ? (
          <Badge variant="destructive">Desatualizado</Badge>
        ) : (
          <Badge variant="secondary">Em dia</Badge>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <ListToolbar
        activeFilterCount={activeFilterCount}
        onClearFilters={() =>
          void navigate({ search: { marketId: undefined, productId: undefined, source: undefined, staleOnly: undefined } })
        }
        filters={
          <>
            <div className="w-full sm:w-64">
              <EntityPicker
                useList={useProductsPicker}
                value={search.productId ?? null}
                onChange={(id) => void navigate({ search: { ...search, productId: id ?? undefined } })}
                getId={(p) => p.id}
                getLabel={(p) => p.name}
                placeholder="Filtrar por produto"
                searchPlaceholder="Buscar produto…"
                emptyText="Nenhum produto encontrado"
              />
            </div>
            <div className="w-full sm:w-64">
              <EntityPicker
                useList={useMarketsPicker}
                value={search.marketId ?? null}
                onChange={(id) => void navigate({ search: { ...search, marketId: id ?? undefined } })}
                getId={(m) => m.id}
                getLabel={(m) => m.tradeName}
                placeholder="Filtrar por mercado"
                searchPlaceholder="Buscar mercado…"
                emptyText="Nenhum mercado encontrado"
              />
            </div>
            <Select
              value={search.source ?? "__all__"}
              onValueChange={(next) =>
                void navigate({ search: { ...search, source: next === "__all__" ? undefined : next } })
              }
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as fontes</SelectItem>
                {PRICE_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={search.staleOnly ? "stale" : "all"}
              onValueChange={(next) =>
                void navigate({ search: { ...search, staleOnly: next === "stale" ? true : undefined } })
              }
            >
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os preços</SelectItem>
                <SelectItem value="stale">Só desatualizados (+15 dias)</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {list.total === 0 && !list.isLoading ? (
        <EmptyState
          icon={LuDollarSign}
          title="Nenhum preço encontrado"
          description="Ajuste os filtros ou aguarde o app/coletores registrarem observações de preço."
        />
      ) : (
        <DataList
          items={list.items}
          columns={columns}
          getRowId={(p) => p.id}
          isLoading={list.isLoading}
          isFetching={list.isFetching}
          isFetchingNextPage={list.isFetchingNextPage}
          hasNextPage={list.hasNextPage}
          fetchNextPage={() => void list.fetchNextPage()}
          total={list.total}
          emptyTitle="Nenhum preço encontrado"
        />
      )}
    </div>
  );
}
