import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export interface CategorySpending {
  categoryId: string | null;
  categoryName: string;
  amount: string;
}

export interface MonthlyReport {
  month: string;
  totalAmount: string;
  purchaseCount: number;
  byCategory: CategorySpending[];
}

export interface MonthSummary {
  month: string;
  totalAmount: string;
}

export type PurchaseOrigin = "cart" | "receipt";

export interface Purchase {
  id: string;
  marketId: string | null;
  marketName: string;
  purchaseAt: string;
  itemCount: number;
  totalAmount: string;
  origin: PurchaseOrigin;
}

export function useMonthlyReport(month: string) {
  return useQuery({
    queryKey: ["reports", "monthly", month],
    queryFn: async () => {
      const res = await apiClient.get<MonthlyReport>("/api/reports/monthly", { month });
      return res.data;
    },
  });
}

export function useMonthsSummary() {
  return useQuery({
    queryKey: ["reports", "months"],
    queryFn: async () => {
      const res = await apiClient.get<MonthSummary[]>("/api/reports/months");
      return res.data;
    },
  });
}
