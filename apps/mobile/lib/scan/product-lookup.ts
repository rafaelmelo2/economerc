// Lookup de produto por EAN para o scan. Usa o cliente autenticado (`lib/api`, refresh em 401)
// e a cidade da sessão. Qualquer falha vira "sem preço conhecido" — nunca trava o scan, sempre
// cai no fluxo de cadastro rápido.
import type { ProductUnit } from "@/lib/cart/contract";
import { apiClient } from "@/lib/api/client";
import { validateGtin } from "@/lib/scan/gtin";
import { useSessionStore } from "@/lib/store/session-store";

export type KnownPriceSource = "nfce" | "community" | "flyer" | "manual" | "partner" | "scraper";
export type UnitPriceLabel = "kg" | "l" | "un";

export interface KnownMarketPrice {
  marketId: string;
  marketName: string;
  amountCents: number;
  unitAmountCents: number | null;
  unitLabel: UnitPriceLabel | null;
  source: KnownPriceSource;
  isStale: boolean;
  observedAt: string; // ISO 8601 UTC
}

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

interface PriceObservationResponseBody {
  id: string;
  marketId: string;
  marketName: string;
  amount: string;
  unitAmount: string | null;
  unitLabel: UnitPriceLabel | null;
  source: KnownPriceSource;
  observedAt: string;
  isStale: boolean;
}

/** "18.90" (Decimal serializado como string, nunca float — ver `.claude/rules/backend.md`) → 1890. */
function parseDecimalStringToCents(value: string): number {
  const [wholePart = "0", fractionPart = ""] = value.split(".");
  const paddedFraction = `${fractionPart}00`.slice(0, 2);
  const sign = wholePart.startsWith("-") ? -1 : 1;
  const digitsOnly = wholePart.replace("-", "") || "0";
  return sign * (Number.parseInt(digitsOnly, 10) * 100 + Number.parseInt(paddedFraction, 10));
}

function mapPriceObservation(body: PriceObservationResponseBody): KnownMarketPrice {
  return {
    marketId: body.marketId,
    marketName: body.marketName,
    amountCents: parseDecimalStringToCents(body.amount),
    unitAmountCents: body.unitAmount === null ? null : parseDecimalStringToCents(body.unitAmount),
    unitLabel: body.unitLabel,
    source: body.source,
    isStale: body.isStale,
    observedAt: body.observedAt,
  };
}

/** Entre vários mercados, mostramos o preço mais recente (o "sugerido" da folha de confirmação). */
function pickMostRecentObservation(
  observations: readonly PriceObservationResponseBody[],
): PriceObservationResponseBody | null {
  if (observations.length === 0) return null;
  return observations.reduce((latest, current) =>
    new Date(current.observedAt).getTime() > new Date(latest.observedAt).getTime() ? current : latest,
  );
}

async function fetchLatestKnownPrice(ean: string, cityId: string): Promise<KnownMarketPrice | null> {
  try {
    const response = await apiClient.get<PriceObservationResponseBody[]>("/prices", {
      ean,
      city_id: cityId,
    });
    if (!response.success) return null; // 404/5xx → sem preço conhecido, nunca erro fatal
    const latest = pickMostRecentObservation(response.data);
    return latest ? mapPriceObservation(latest) : null;
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
  const price = cityId ? await fetchLatestKnownPrice(validation.code, cityId) : null;
  return { status: "found", product: productResult.product, price };
}
