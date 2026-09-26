// Porta de lookup de produto por EAN (contrato do bloco 3B). Implementação PROVISÓRIA por
// `fetch` cru contra `EXPO_PUBLIC_API_URL`, sem autenticação — o bloco 3A troca o corpo desta
// função pelo cliente HTTP autenticado real (`lib/api`), mantendo a MESMA assinatura de
// `lookupProductByEan` e o mesmo `ProductLookupResult`, que é tudo que a UI de scan consome.
//
// `GET /api/products/by-ean/{ean}` e `GET /api/prices` hoje exigem sessão (`CurrentUser`) —
// sem token, toda chamada volta 401. Tratamos 401 (e qualquer erro de rede/timeout) como
// "sem preço conhecido": nunca trava o scan, sempre cai no fluxo de cadastro rápido.
import type { ProductUnit } from "@/lib/cart/contract";
import { validateGtin } from "@/lib/scan/gtin";

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

const DEFAULT_API_BASE_URL = "http://localhost:8010";
const REQUEST_TIMEOUT_MS = 4000;

function resolveApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
}

/**
 * Cidade ativa do usuário, em `city_id` (UUID) do backend. Não existe hoje, nesta base de
 * código, nenhuma ponte entre `citySlug` (onboarding, `lib/mock/cities.ts`) e o `city_id` real —
 * isso nasce junto do cliente autenticado do bloco 3A. Até lá, sem `cityId` só o produto é
 * buscado (nunca o preço), e a folha de confirmação trata como "achamos o produto, mas não
 * o preço" — exatamente o fallback que `docs/brand/voz.md` já prevê.
 */
function resolveActiveCityId(): string | null {
  return null;
}

async function fetchJson(path: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${resolveApiBaseUrl()}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

interface ProductResponseBody {
  id: string;
  ean: string | null;
  name: string;
  brand: string | null;
  category_id: string | null;
  unit: ProductUnit;
  net_quantity: string | null;
  image_upload_id: string | null;
  source: string;
}

function mapProductResponse(body: ProductResponseBody, fallbackEan: string): LookedUpProduct {
  return {
    productId: body.id,
    ean: body.ean ?? fallbackEan,
    name: body.name,
    brand: body.brand,
    unit: body.unit,
    categoryId: body.category_id,
  };
}

type FetchProductResult =
  | { status: "found"; product: LookedUpProduct }
  | { status: "not-found" }
  | { status: "unavailable" };

async function fetchProductByEan(ean: string): Promise<FetchProductResult> {
  try {
    const response = await fetchJson(`/api/products/by-ean/${ean}`);
    if (response.status === 401) return { status: "unavailable" };
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "unavailable" };

    const body = (await response.json()) as ProductResponseBody;
    return { status: "found", product: mapProductResponse(body, ean) };
  } catch {
    return { status: "unavailable" };
  }
}

interface PriceObservationResponseBody {
  id: string;
  market_id: string;
  market_name: string;
  amount: string;
  unit_amount: string | null;
  unit_label: UnitPriceLabel | null;
  source: KnownPriceSource;
  observed_at: string;
  is_stale: boolean;
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
    marketId: body.market_id,
    marketName: body.market_name,
    amountCents: parseDecimalStringToCents(body.amount),
    unitAmountCents: body.unit_amount === null ? null : parseDecimalStringToCents(body.unit_amount),
    unitLabel: body.unit_label,
    source: body.source,
    isStale: body.is_stale,
    observedAt: body.observed_at,
  };
}

/** Entre vários mercados, mostramos o preço mais recente (o "sugerido" da folha de confirmação). */
function pickMostRecentObservation(
  observations: readonly PriceObservationResponseBody[],
): PriceObservationResponseBody | null {
  if (observations.length === 0) return null;
  return observations.reduce((latest, current) =>
    new Date(current.observed_at).getTime() > new Date(latest.observed_at).getTime() ? current : latest,
  );
}

async function fetchLatestKnownPrice(ean: string, cityId: string): Promise<KnownMarketPrice | null> {
  try {
    const response = await fetchJson(`/api/prices?ean=${ean}&city_id=${cityId}`);
    if (!response.ok) return null; // 401/404/5xx → sem preço conhecido, nunca erro fatal

    const body = (await response.json()) as PriceObservationResponseBody[];
    const latest = pickMostRecentObservation(body);
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
