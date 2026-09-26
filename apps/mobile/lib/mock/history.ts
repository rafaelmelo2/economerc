import type { CategorySpend, HistoryPurchase } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/mock/categories";

export const MOCK_SAVINGS_CENTS = 9420;

export const MOCK_CATEGORY_SPEND: readonly CategorySpend[] = [
  { category: "mercearia", label: CATEGORY_LABELS.mercearia, totalCents: 31200 },
  { category: "carnes", label: CATEGORY_LABELS.carnes, totalCents: 23100 },
  { category: "hortifruti", label: CATEGORY_LABELS.hortifruti, totalCents: 12800 },
  { category: "laticinios", label: CATEGORY_LABELS.laticinios, totalCents: 10400 },
  { category: "limpeza", label: CATEGORY_LABELS.limpeza, totalCents: 6900 },
];

export const MOCK_PURCHASES: readonly HistoryPurchase[] = [
  {
    id: "purchase-1",
    date: new Date(2026, 8, 20),
    marketName: "Bom Preço",
    itemCount: 23,
    totalCents: 21477,
  },
  {
    id: "purchase-2",
    date: new Date(2026, 8, 13),
    marketName: "Supermercado Central",
    itemCount: 15,
    totalCents: 14235,
  },
  {
    id: "purchase-3",
    date: new Date(2026, 8, 6),
    marketName: "Mercado Catalão",
    itemCount: 31,
    totalCents: 28990,
  },
];
