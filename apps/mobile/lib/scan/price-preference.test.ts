// Escolha do preço sugerido por mercado (bloco 6, docs/produto.md) — lógica pura, sem I/O
// (tests.md > Frontend Testing > Scope). `lookupProductByEan` em si bate na rede e na sessão;
// as duas funções aqui são o coração da decisão e valem o teste isolado.
import { describe, expect, it } from "vitest";

import {
  mapPriceObservation,
  pickPreferredObservation,
  type PriceObservationResponseBody,
} from "@/lib/scan/price-preference";

function observation(
  overrides: Partial<PriceObservationResponseBody> & Pick<PriceObservationResponseBody, "marketId">,
): PriceObservationResponseBody {
  return {
    id: `price-${overrides.marketId}`,
    marketName: `Mercado ${overrides.marketId}`,
    amount: "10.00",
    unitAmount: null,
    unitLabel: null,
    source: "community",
    observedAt: "2026-09-20T12:00:00.000Z",
    isStale: false,
    ...overrides,
  };
}

describe("pickPreferredObservation", () => {
  it("prefere o preço do mercado atual do carrinho mesmo quando não é o mais recente", () => {
    const here = observation({ marketId: "market-here", observedAt: "2026-09-10T12:00:00.000Z" });
    const elsewhereNewer = observation({
      marketId: "market-elsewhere",
      observedAt: "2026-09-25T12:00:00.000Z",
    });

    const chosen = pickPreferredObservation([elsewhereNewer, here], "market-here");

    expect(chosen).toBe(here);
  });

  it("cai pro mais recente de qualquer mercado quando não há observação do mercado atual", () => {
    const older = observation({ marketId: "market-a", observedAt: "2026-09-10T12:00:00.000Z" });
    const newer = observation({ marketId: "market-b", observedAt: "2026-09-25T12:00:00.000Z" });

    const chosen = pickPreferredObservation([older, newer], "market-with-no-observation");

    expect(chosen).toBe(newer);
  });

  it("cai pro mais recente quando o carrinho ainda não tem mercado (currentMarketId null)", () => {
    const older = observation({ marketId: "market-a", observedAt: "2026-09-10T12:00:00.000Z" });
    const newer = observation({ marketId: "market-b", observedAt: "2026-09-25T12:00:00.000Z" });

    const chosen = pickPreferredObservation([older, newer], null);

    expect(chosen).toBe(newer);
  });

  it("devolve null para lista vazia", () => {
    expect(pickPreferredObservation([], "market-here")).toBeNull();
  });
});

describe("mapPriceObservation", () => {
  it("marca isCurrentMarket true quando o preço é do mercado do carrinho", () => {
    const body = observation({ marketId: "market-here", amount: "12.49" });

    const mapped = mapPriceObservation(body, "market-here");

    expect(mapped.isCurrentMarket).toBe(true);
    expect(mapped.amountCents).toBe(1249);
  });

  it("marca isCurrentMarket false quando o preço é de outro mercado (referência)", () => {
    const body = observation({ marketId: "market-elsewhere", amount: "12.49" });

    const mapped = mapPriceObservation(body, "market-here");

    expect(mapped.isCurrentMarket).toBe(false);
    expect(mapped.marketName).toBe("Mercado market-elsewhere");
  });

  it("marca isCurrentMarket false quando o carrinho não tem mercado definido", () => {
    const body = observation({ marketId: "market-elsewhere" });

    const mapped = mapPriceObservation(body, null);

    expect(mapped.isCurrentMarket).toBe(false);
  });
});
