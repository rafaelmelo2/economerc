// Resolução de EAN: SQLite → API → manual (rules/mobile.md > Scan). Camada de
// dados só — a tela de scan (3B) decide o que fazer quando `resolveProductByEan`
// devolve `null` (fotografar etiqueta / digitar manualmente).

import { type ProductResponse, productResponseSchema } from "@economerc/shared";

import { getDb } from "@/lib/db/client";
import {
  findCachedProductByEan,
  isProductCacheStale,
  upsertCachedProduct,
} from "@/lib/db/products-cache-repository";
import type { ProductCacheRow } from "@/lib/db/types";

import { apiClient } from "./client";

export type ProductLookupSource = "cache" | "cache_stale" | "network";

export interface ProductLookupResult {
  source: ProductLookupSource;
  product: ProductResponse;
}

function toCacheRow(product: ProductResponse, fetchedAt: string): ProductCacheRow {
  return {
    ean: product.ean ?? "",
    product_id: product.id,
    name: product.name,
    brand: product.brand,
    category_id: product.categoryId,
    unit: product.unit,
    net_quantity: product.netQuantity,
    fetched_at: fetchedAt,
  };
}

function fromCacheRow(row: ProductCacheRow): ProductResponse {
  return {
    id: row.product_id ?? "",
    ean: row.ean,
    name: row.name,
    brand: row.brand,
    categoryId: row.category_id,
    unit: row.unit as ProductResponse["unit"],
    netQuantity: row.net_quantity,
    imageUploadId: null,
    source: "cache",
  };
}

async function fetchProductFromNetwork(ean: string): Promise<ProductResponse | null> {
  const res = await apiClient.get<unknown>(`/products/by-ean/${ean}`);
  if (res.status === 404) return null;
  if (!res.success) throw new Error("Falha ao consultar o produto — tente novamente.");
  return productResponseSchema.parse(res.data);
}

/** Cache local primeiro (resposta instantânea, funciona em modo avião);
 * atualiza em background quando há rede. Cache com mais de 15 dias volta
 * marcado `cache_stale` — a UI decide se confirma o preço de novo. */
export async function resolveProductByEan(ean: string): Promise<ProductLookupResult | null> {
  const db = getDb();
  const cached = findCachedProductByEan(db, ean);

  try {
    const fresh = await fetchProductFromNetwork(ean);
    if (fresh === null) return cached ? { source: "cache_stale", product: fromCacheRow(cached) } : null;
    upsertCachedProduct(db, toCacheRow(fresh, new Date().toISOString()));
    return { source: "network", product: fresh };
  } catch {
    if (!cached) return null;
    return { source: isProductCacheStale(cached) ? "cache_stale" : "cache", product: fromCacheRow(cached) };
  }
}
