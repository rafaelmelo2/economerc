// Tipos locais para a casca (onda 1). O contrato real de dados chega em `packages/shared`
// na onda 3 (sync); por ora tudo aqui é mock tipado, sem `any`.

export type CategoryKey =
  | "hortifruti"
  | "laticinios"
  | "mercearia"
  | "bebidas"
  | "carnes"
  | "padaria"
  | "congelados"
  | "limpeza"
  | "higiene"
  | "outros";

export type BudgetState = "ok" | "warning" | "over";

export interface BudgetStatus {
  state: BudgetState;
  spentCents: number;
  budgetCents: number;
  remainingCents: number;
  percentage: number;
}

export interface CityOption {
  slug: string;
  name: string;
  state: string;
}

export interface CategorySpend {
  category: CategoryKey;
  label: string;
  totalCents: number;
}

export interface HistoryPurchase {
  id: string;
  date: Date;
  marketName: string;
  itemCount: number;
  totalCents: number;
}
