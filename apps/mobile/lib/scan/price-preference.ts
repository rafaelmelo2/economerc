// Lógica PURA de escolha do preço sugerido por mercado (bloco 6, docs/produto.md) — nenhum
// import de React Native/Expo aqui de propósito, pra poder ser testada isoladamente
// (tests.md > Frontend Testing > Scope: "lógica pura sem I/O"). `lib/scan/product-lookup.ts`
// é quem soma I/O (rede, sessão, carrinho) em cima disto.

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
  /** `true` = preço observado no MESMO mercado do carrinho ativo (o "preço daqui").
   * `false` = referência de outro mercado — nunca assumir que é o preço da compra atual
   * (bloco 6, `docs/produto.md`). */
  isCurrentMarket: boolean;
}

export interface PriceObservationResponseBody {
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
export function parseDecimalStringToCents(value: string): number {
  const [wholePart = "0", fractionPart = ""] = value.split(".");
  const paddedFraction = `${fractionPart}00`.slice(0, 2);
  const sign = wholePart.startsWith("-") ? -1 : 1;
  const digitsOnly = wholePart.replace("-", "") || "0";
  return sign * (Number.parseInt(digitsOnly, 10) * 100 + Number.parseInt(paddedFraction, 10));
}

export function mapPriceObservation(
  body: PriceObservationResponseBody,
  currentMarketId: string | null,
): KnownMarketPrice {
  return {
    marketId: body.marketId,
    marketName: body.marketName,
    amountCents: parseDecimalStringToCents(body.amount),
    unitAmountCents: body.unitAmount === null ? null : parseDecimalStringToCents(body.unitAmount),
    unitLabel: body.unitLabel,
    source: body.source,
    isStale: body.isStale,
    observedAt: body.observedAt,
    isCurrentMarket: currentMarketId !== null && body.marketId === currentMarketId,
  };
}

/** Entre vários mercados, mostramos o preço mais recente (o "sugerido" da folha de confirmação). */
export function pickMostRecentObservation(
  observations: readonly PriceObservationResponseBody[],
): PriceObservationResponseBody | null {
  if (observations.length === 0) return null;
  return observations.reduce((latest, current) =>
    new Date(current.observedAt).getTime() > new Date(latest.observedAt).getTime() ? current : latest,
  );
}

/** Preferimos o preço do MESMO mercado do carrinho ativo — é o "preço daqui". Sem carrinho com
 * mercado definido, ou sem observação desse mercado, caímos pro mais recente de qualquer
 * mercado como referência (`isCurrentMarket: false` — a UI nunca finge que é o preço local). */
export function pickPreferredObservation(
  observations: readonly PriceObservationResponseBody[],
  currentMarketId: string | null,
): PriceObservationResponseBody | null {
  if (currentMarketId !== null) {
    const here = observations.find((observation) => observation.marketId === currentMarketId);
    if (here) return here;
  }
  return pickMostRecentObservation(observations);
}
