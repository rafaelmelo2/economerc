// Lookup de produto por EAN para o scan. Usa o cliente autenticado (`lib/api`, refresh em 401)
// e a cidade da sessão. Qualquer falha vira "sem preço conhecido" — nunca trava o scan, sempre
// cai no fluxo de cadastro rápido. A escolha do preço em si (`price-preference.ts`) é lógica
// pura, testada isolada — este arquivo só soma I/O (rede, sessão, carrinho) em cima dela.
import { getActiveCartMarketId, type ProductUnit } from "@/lib/cart/contract";
import { apiClient } from "@/lib/api/client";
import {
  type KnownMarketPrice,
  mapPriceObservation,
  pickPreferredObservation,
  type PriceObservationResponseBody,
} from "@/lib/scan/price-preference";
import { validateGtin } from "@/lib/scan/gtin";
import { useSessionStore } from "@/lib/store/session-store";

export type { KnownMarketPrice, KnownPriceSource, UnitPriceLabel } from "@/lib/scan/price-preference";

export interface LookedUpProduct {
  productId: string;
  ean: string;
  name: string;
  brand: string | null;
  unit: ProductUnit;
  categoryId: string | null;
}

export type ProductLookupResult =
  | { status: "found"; product: LookedUpProduct; price: KnownMarketPrice | null }
  | { status: "not-found" }
  | { status: "invalid-ean" }
  /** 401 sem sessão, rede fora, timeout ou 5xx — nunca é erro fatal pra UI. */
  | { status: "unavailable" };

/**
 * Cidade ativa do usuário (UUID de `GET /api/cities`), escolhida no onboarding e guardada na
 * sessão. Sem cidade, só o produto é buscado — a folha cai em "achamos o produto, mas não o
 * preço" (`docs/brand/voz.md`).
 */
function resolveActiveCityId(): string | null {
  return useSessionStore.getState().onboarding.cityId;
}

// Corpos já em camelCase: o `ApiClient` (packages/shared) converte snake_case na borda.
interface ProductResponseBody {
  id: string;
  ean: string | null;
  name: string;
  brand: string | null;
  categoryId: string | null;
  unit: ProductUnit;
}

function mapProductResponse(body: ProductResponseBody, fallbackEan: string): LookedUpProduct {
  return {
    productId: body.id,
    ean: body.ean ?? fallbackEan,
    name: body.name,
    brand: body.brand,
    unit: body.unit,
    categoryId: body.categoryId,
  };
}

type FetchProductResult =
  | { status: "found"; product: LookedUpProduct }
  | { status: "not-found" }
  | { status: "unavailable" };

async function fetchProductByEan(ean: string): Promise<FetchProductResult> {
  try {
    const response = await apiClient.get<ProductResponseBody>(`/products/by-ean/${ean}`);
    if (response.status === 404) return { status: "not-found" };
    if (!response.success) return { status: "unavailable" };
    return { status: "found", product: mapProductResponse(response.data, ean) };
  } catch {
    return { status: "unavailable" }; // rede fora: nunca trava o scan
  }
}

async function fetchLatestKnownPrice(
  ean: string,
  cityId: string,
  currentMarketId: string | null,
): Promise<KnownMarketPrice | null> {
  try {
    const response = await apiClient.get<PriceObservationResponseBody[]>("/prices", {
      ean,
      city_id: cityId,
    });
    if (!response.success) return null; // 404/5xx → sem preço conhecido, nunca erro fatal
    const chosen = pickPreferredObservation(response.data, currentMarketId);
    return chosen ? mapPriceObservation(chosen, currentMarketId) : null;
  } catch {
    return null;
  }
}

export async function lookupProductByEan(ean: string): Promise<ProductLookupResult> {
  const validation = validateGtin(ean);
  if (!validation.valid) return { status: "invalid-ean" };

  const productResult = await fetchProductByEan(validation.code);
  if (productResult.status !== "found") return productResult;

  const cityId = resolveActiveCityId();
  const currentMarketId = getActiveCartMarketId();
  const price = cityId ? await fetchLatestKnownPrice(validation.code, cityId, currentMarketId) : null;
  return { status: "found", product: productResult.product, price };
}
