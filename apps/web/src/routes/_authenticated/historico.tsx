import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/empty-state";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInfiniteList } from "@/hooks/useInfiniteList";
import { useMonthlyReport, useMonthsSummary, type Purchase } from "@/lib/api/reports";
import { formatMoneyFromApi } from "@/lib/money";
import { LuHistory } from "react-icons/lu";

export const Route = createFileRoute("/_authenticated/historico")({
  validateSearch: (search: Record<string, unknown>): { month?: string } => ({
    month: typeof search.month === "string" ? search.month : undefined,
  }),
  component: HistoricoPage,
});

const CATEGORY_CHART_CONFIG: ChartConfig = {
  amount: { label: "Gasto", color: "var(--color-primary)" },
};

const EVOLUTION_CHART_CONFIG: ChartConfig = {
  totalAmount: { label: "Total do mês", color: "var(--color-primary)" },
};

const CURRENT_MONTH_OPACITY = 1;
const PAST_MONTH_OPACITY = 0.4;
const PURCHASE_ORIGIN_LABEL: Record<Purchase["origin"], string> = {
  cart: "Carrinho do app",
  receipt: "Nota fiscal",
};

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return new Date(year, monthNumber - 1, 1);
}

function formatMonthLabel(month: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(parseMonthKey(month));
}

function formatMonthShort(month: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(parseMonthKey(month)).replace(".", "");
}

function formatPurchaseDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

function MonthSelect({ month, onChange }: { month: string; onChange: (next: string) => void }) {
  const { data: months } = useMonthsSummary();
  const options = months ?? [{ month, totalAmount: "0" }];

  return (
    <Select value={month} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-56" aria-label="Selecionar mês">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[...options].reverse().map((option) => (
          <SelectItem key={option.month} value={option.month}>
            {formatMonthLabel(option.month)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SummaryCards({ totalAmount, purchaseCount }: { totalAmount: string; purchaseCount: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">Total gasto no mês</p>
        <p className="mt-1 font-display text-2xl font-bold">{formatMoneyFromApi(totalAmount)}</p>
      </div>
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">Compras no mês</p>
        <p className="mt-1 font-display text-2xl font-bold">{purchaseCount}</p>
      </div>
    </div>
  );
}

function CategoryChart({ byCategory }: { byCategory: { categoryName: string; amount: string }[] }) {
  if (byCategory.length === 0) return null;
  const data = byCategory.map((row) => ({ ...row, amountNumber: Number(row.amount) }));

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 font-display text-base font-bold">Gasto por categoria</h2>
      <ChartContainer config={CATEGORY_CHART_CONFIG} className="h-64 w-full">
        <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            dataKey="categoryName"
            type="category"
            width={110}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="amountNumber" fill="var(--color-amount)" radius={4} />
        </BarChart>
      </ChartContainer>
      {/* Visão em tabela — legenda acessível (docs/brand/visual.md > Gráficos). */}
      <dl className="mt-4 space-y-1 text-sm">
        {byCategory.map((row) => (
          <div key={row.categoryName} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{row.categoryName}</dt>
            <dd className="num font-medium">{formatMoneyFromApi(row.amount)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EvolutionChart({ months, currentMonth }: { months: { month: string; totalAmount: string }[]; currentMonth: string }) {
  const data = months.map((row) => ({
    ...row,
    amountNumber: Number(row.totalAmount),
    label: formatMonthShort(row.month),
  }));

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="mb-4 font-display text-base font-bold">Evolução (últimos 12 meses)</h2>
      <ChartContainer config={EVOLUTION_CHART_CONFIG} className="h-64 w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis hide />
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Bar dataKey="amountNumber" radius={4}>
            {data.map((row) => (
              <Cell
                key={row.month}
                fill="var(--color-totalAmount)"
                opacity={row.month === currentMonth ? CURRENT_MONTH_OPACITY : PAST_MONTH_OPACITY}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}

const PURCHASE_COLUMNS: DataListColumn<Purchase>[] = [
  {
    id: "date",
    header: "Data",
    role: "primary",
    cell: (item) => formatPurchaseDate(item.purchaseAt),
  },
  {
    id: "market",
    header: "Mercado",
    role: "secondary",
    cell: (item) => item.marketName,
  },
  {
    id: "origin",
    header: "Origem",
    role: "badge",
    cell: (item) => (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
        {PURCHASE_ORIGIN_LABEL[item.origin]}
      </span>
    ),
  },
  {
    id: "items",
    header: "Itens",
    cell: (item) => item.itemCount,
  },
  {
    id: "total",
    header: "Total",
    cell: (item) => <span className="num">{formatMoneyFromApi(item.totalAmount)}</span>,
  },
];

function HistoricoPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const month = search.month ?? currentMonthKey();

  const monthlyQuery = useMonthlyReport(month);
  const monthsQuery = useMonthsSummary();
  const purchases = useInfiniteList<Purchase>("/api/reports/purchases");

  const hasAnyPurchase = (monthlyQuery.data?.purchaseCount ?? 0) > 0 || purchases.total > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="sr-only">Histórico</h1>
        <MonthSelect month={month} onChange={(next) => void navigate({ search: { month: next } })} />
      </div>

      {monthlyQuery.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl border bg-muted" />
      ) : monthlyQuery.data ? (
        <SummaryCards
          totalAmount={monthlyQuery.data.totalAmount}
          purchaseCount={monthlyQuery.data.purchaseCount}
        />
      ) : null}

      {monthlyQuery.data && monthlyQuery.data.byCategory.length > 0 && (
        <CategoryChart byCategory={monthlyQuery.data.byCategory} />
      )}

      {monthsQuery.data && monthsQuery.data.length > 0 && (
        <EvolutionChart months={monthsQuery.data} currentMonth={currentMonthKey()} />
      )}

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-base font-bold">Compras</h2>
        {!hasAnyPurchase && purchases.items.length === 0 && !purchases.isLoading ? (
          <EmptyState
            icon={LuHistory}
            title="Sua primeira compra aparece aqui"
            description="Escaneie os produtos no app ou leia a nota fiscal no fim da compra. O histórico e os gráficos por categoria aparecem aqui assim que a primeira compra chegar."
          />
        ) : (
          <DataList
            items={purchases.items}
            columns={PURCHASE_COLUMNS}
            getRowId={(item) => item.id}
            isLoading={purchases.isLoading}
            isFetching={purchases.isFetching}
            isFetchingNextPage={purchases.isFetchingNextPage}
            hasNextPage={purchases.hasNextPage}
            fetchNextPage={() => void purchases.fetchNextPage()}
            total={purchases.total}
            emptyTitle="Nenhuma compra encontrada"
          />
        )}
      </div>
    </div>
  );
}
