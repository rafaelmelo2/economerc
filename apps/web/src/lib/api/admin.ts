import type { PagedResponse } from "@economerc/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { toJsonBody } from "@economerc/shared";

/* ── Categorias (catálogo) — lista fixa (10, seed), bounded: Select, não EntityPicker. ───── */

export interface Category {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  icon: string;
  position: number;
}

export function useCategories() {
  return useQuery({
    queryKey: ["/api/categories", "list", "all"],
    queryFn: async () => {
      const res = await apiClient.get<PagedResponse<Category>>("/api/categories", { limit: 50 });
      return res.data.items;
    },
    staleTime: Infinity,
  });
}

/* ── Cidades — só Catalão-GO na Fase 1; bounded do mesmo jeito. ──────────── */

export interface City {
  id: string;
  name: string;
  stateCode: string;
}

export function useCities() {
  return useQuery({
    queryKey: ["/api/cities", "list", "all"],
    queryFn: async () => {
      const res = await apiClient.get<PagedResponse<City>>("/api/cities", { limit: 50 });
      return res.data.items;
    },
    staleTime: Infinity,
  });
}

/* ── Produtos ────────────────────────────────────────────────────────────── */

export interface Product {
  id: string;
  ean: string | null;
  name: string;
  brand: string | null;
  categoryId: string | null;
  unit: "un" | "kg" | "g" | "l" | "ml";
  netQuantity: string | null;
  source: string;
}

export interface ProductUpsertPayload {
  ean?: string | null;
  name: string;
  brand?: string | null;
  categoryId?: string | null;
  unit?: Product["unit"];
  netQuantity?: string | null;
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ProductUpsertPayload) => {
      const res = await apiClient.post<Product>("/api/products", toJsonBody(payload));
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/products", "list"] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ProductUpsertPayload> }) => {
      const res = await apiClient.patch<Product>(`/api/products/${id}`, toJsonBody(payload));
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/products", "list"] }),
  });
}

/* ── Mercados ────────────────────────────────────────────────────────────── */

export interface Market {
  id: string;
  cityId: string;
  cnpj: string | null;
  legalName: string | null;
  tradeName: string;
  address: string | null;
  isPartner: boolean;
}

export interface MarketUpsertPayload {
  cityId?: string;
  tradeName: string;
  cnpj?: string | null;
  legalName?: string | null;
  address?: string | null;
  isPartner?: boolean;
}

export function useCreateMarket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MarketUpsertPayload) => {
      const res = await apiClient.post<Market>("/api/markets", toJsonBody(payload));
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/markets", "list"] }),
  });
}

export function useUpdateMarket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<MarketUpsertPayload> }) => {
      const res = await apiClient.patch<Market>(`/api/markets/${id}`, toJsonBody(payload));
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/markets", "list"] }),
  });
}

/* ── Preços (admin) ──────────────────────────────────────────────────────── */

export interface AdminPrice {
  id: string;
  productId: string;
  productName: string;
  productEan: string | null;
  marketId: string;
  marketName: string;
  amount: string;
  source: string;
  confidence: string;
  observedAt: string;
  isStale: boolean;
}

/* ── Notas com falha (admin) ─────────────────────────────────────────────── */

export interface AdminReceipt {
  id: string;
  userEmail: string | null;
  marketName: string | null;
  status: "pending" | "processing" | "done" | "failed" | "duplicate";
  failureReason: string | null;
  attempts: number;
  createdAt: string;
}

export function useRetryReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<AdminReceipt>(`/api/admin/receipts/${id}/retry`, {});
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/receipts", "list"] }),
  });
}

/* ── Fila de ofertas (coletores) ─────────────────────────────────────────── */

export interface OfferCandidate {
  id: string;
  marketId: string;
  productName: string;
  ean: string | null;
  priceAmount: string;
  unit: string | null;
  rawText: string | null;
  source: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export function useApproveOfferCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const res = await apiClient.post<OfferCandidate>(
        `/api/admin/offer-candidates/${id}/approve`,
        toJsonBody({ productId }),
      );
      return res.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offer-candidates", "list"] }),
  });
}

export function useRejectOfferCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<OfferCandidate>(`/api/admin/offer-candidates/${id}/reject`);
      return res.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/offer-candidates", "list"] }),
  });
}

export interface CollectorRun {
  id: string;
  collector: string;
  status: "running" | "success" | "failed";
  itemsFound: number;
  aliasesCreated: number;
  pricesCreated: number;
  errorMessage: string | null;
}

export function useRunSupercatalaoCollector() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<CollectorRun>("/api/admin/collectors/supercatalao/run", {});
      return res.data;
    },
  });
}
