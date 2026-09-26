// Fixtures do modo demo (`?demo=1`) — a câmera não roda em screenshot (Playwright/CI), então o
// scan simulado usa estes dados fixos em vez de bater na rede. Mesmos itens do mock da vitrine
// (`docs/brand/vitrine.html`), pra validação visual bater com a referência da marca.
import type { ProductUnit } from "@/lib/cart/contract";
import type { KnownPriceSource, ProductLookupResult, UnitPriceLabel } from "@/lib/scan/product-lookup";

interface DemoScanFixture {
  ean: string;
  name: string;
  brand: string | null;
  unit: ProductUnit;
  amountCents: number;
  unitAmountCents: number | null;
  unitLabel: UnitPriceLabel | null;
  source: KnownPriceSource;
  marketName: string;
  daysAgo: number;
  isStale: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const DEMO_SCAN_FIXTURES: readonly DemoScanFixture[] = [
  {
    ean: "7891000100103",
    name: "Café Pilão 500 g",
    brand: "Pilão",
    unit: "un",
    amountCents: 1890,
    unitAmountCents: 3780,
    unitLabel: "kg",
    source: "community",
    marketName: "Bom Preço",
    daysAgo: 2,
    isStale: false,
  },
  {
    ean: "7891000053508",
    name: "Leite integral 1 L",
    brand: null,
    unit: "un",
    amountCents: 449,
    unitAmountCents: 449,
    unitLabel: "l",
    source: "community",
    marketName: "Bom Preço",
    daysAgo: 1,
    isStale: false,
  },
  {
    ean: "7896036090717",
    name: "Arroz branco 5 kg",
    brand: null,
    unit: "un",
    amountCents: 2790,
    unitAmountCents: 558,
    unitLabel: "kg",
    source: "nfce",
    marketName: "Mercado Central",
    daysAgo: 6,
    isStale: false,
  },
  {
    ean: "2000000000012",
    name: "Tomate salada",
    brand: null,
    unit: "kg",
    amountCents: 799,
    unitAmountCents: 799,
    unitLabel: "kg",
    source: "community",
    marketName: "Mercado Central",
    daysAgo: 20,
    isStale: true,
  },
  {
    ean: "2000000000029",
    name: "Peito de frango",
    brand: null,
    unit: "kg",
    amountCents: 2290,
    unitAmountCents: 2290,
    unitLabel: "kg",
    source: "nfce",
    marketName: "Bom Preço",
    daysAgo: 3,
    isStale: false,
  },
];

export const DEMO_SCAN_FIXTURE_COUNT = DEMO_SCAN_FIXTURES.length;

export function buildDemoLookupResult(index: number): ProductLookupResult {
  const fixture = DEMO_SCAN_FIXTURES[index % DEMO_SCAN_FIXTURES.length]!;
  const observedAt = new Date(Date.now() - fixture.daysAgo * DAY_MS).toISOString();

  return {
    status: "found",
    product: {
      productId: `demo-${fixture.ean}`,
      ean: fixture.ean,
      name: fixture.name,
      brand: fixture.brand,
      unit: fixture.unit,
      categoryId: null,
    },
    price: {
      marketId: "demo-market",
      marketName: fixture.marketName,
      amountCents: fixture.amountCents,
      unitAmountCents: fixture.unitAmountCents,
      unitLabel: fixture.unitLabel,
      source: fixture.source,
      isStale: fixture.isStale,
      observedAt,
    },
  };
}

export function demoEanAt(index: number): string {
  return DEMO_SCAN_FIXTURES[index % DEMO_SCAN_FIXTURES.length]!.ean;
}
