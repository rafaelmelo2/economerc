// Agregações do histórico (Onda 5, item 4 do escopo) — lógica PURA em centavos inteiros, sem
// SQLite/API (testável isolada, mesmo espírito de `lib/sync/pull-reducer.ts`). O adapter que lê
// o SQLite de verdade mora em `lib/history/data.ts`.

import type { Purchase } from "@/lib/receipts/reconciliation";
import type { CategoryKey } from "@/lib/types";

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const MONTH_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

/** "2026-09" no fuso de exibição — chave de agrupamento por mês, nunca cálculo de dinheiro. */
export function toSaoPauloMonthKey(isoDate: string): string {
  return MONTH_KEY_FORMATTER.format(new Date(isoDate));
}

/** "2026-09" → dia 15 ao meio-dia UTC — representante seguro do mês (evita virada de dia por
 * fuso perto da meia-noite), só pra alimentar `Intl.DateTimeFormat`/aritmética de mês. */
export function parseMonthKeyToDate(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 15, 12));
}

/** Desloca `monthKey` em `deltaMonths` (negativo = mês anterior) — usado pelo seletor de mês. */
export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const date = parseMonthKeyToDate(monthKey);
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  return toSaoPauloMonthKey(date.toISOString());
}

export function purchasesInMonth(purchases: readonly Purchase[], monthKey: string): Purchase[] {
  return purchases.filter((purchase) => toSaoPauloMonthKey(purchase.date) === monthKey);
}

export function sumPurchasesTotalCents(purchases: readonly Purchase[]): number {
  return purchases.reduce((sum, purchase) => sum + purchase.totalCents, 0);
}

export interface CategoryTotal {
  category: CategoryKey;
  totalCents: number;
}

export interface CartItemForCategoryAggregate {
  cartClientId: string;
  category: CategoryKey;
  totalCents: number;
}

/** Gasto por categoria só enxerga itens de CARRINHO (a nota não categoriza — `raw_name`/EAN
 * cru). Uma compra "matched" ainda soma pela categorização do carrinho; só o TOTAL exibido em
 * `Purchase.totalCents` prefere a nota (`lib/receipts/reconciliation.ts`) — aqui é category mix,
 * não o total, então a fonte certa é sempre o carrinho local. */
export function aggregateCategorySpend(
  purchases: readonly Purchase[],
  cartItems: readonly CartItemForCategoryAggregate[],
): CategoryTotal[] {
  const cartClientIds = new Set(
    purchases.map((purchase) => purchase.cartClientId).filter((id): id is string => id !== null),
  );
  const totals = new Map<CategoryKey, number>();

  for (const item of cartItems) {
    if (!cartClientIds.has(item.cartClientId)) continue;
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.totalCents);
  }

  return [...totals.entries()]
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export interface MonthEvolutionPoint {
  monthKey: string; // "2026-09"
  totalCents: number;
}

/** Últimos `monthsBack` meses (incluindo o mês de referência), do mais antigo pro mais recente —
 * ordem certa pra desenhar barras da esquerda pra direita. Meses sem compra entram com 0 (nunca
 * somem do eixo — "evolução" precisa mostrar o buraco). */
export function aggregateMonthlyEvolution(
  purchases: readonly Purchase[],
  referenceDate: Date,
  monthsBack: number,
): MonthEvolutionPoint[] {
  const totalsByMonth = new Map<string, number>();
  for (const purchase of purchases) {
    const key = toSaoPauloMonthKey(purchase.date);
    totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + purchase.totalCents);
  }

  const points: MonthEvolutionPoint[] = [];
  for (let offset = monthsBack - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(referenceDate);
    cursor.setUTCMonth(cursor.getUTCMonth() - offset);
    const key = toSaoPauloMonthKey(cursor.toISOString());
    points.push({ monthKey: key, totalCents: totalsByMonth.get(key) ?? 0 });
  }
  return points;
}
