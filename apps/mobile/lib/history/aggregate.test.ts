import { describe, expect, it } from "vitest";

import {
  aggregateCategorySpend,
  aggregateMonthlyEvolution,
  purchasesInMonth,
  shiftMonthKey,
  sumPurchasesTotalCents,
  toSaoPauloMonthKey,
} from "./aggregate";
import type { Purchase } from "@/lib/receipts/reconciliation";

function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: "c:1",
    source: "cart",
    date: "2026-09-20T18:00:00.000Z",
    marketName: "Bom Preço",
    itemCount: 10,
    totalCents: 10000,
    cartClientId: "cart-1",
    receiptClientId: null,
    ...overrides,
  };
}

describe("toSaoPauloMonthKey", () => {
  it("usa o fuso America/Sao_Paulo (UTC-3), não o dia UTC cru", () => {
    // 2026-09-01T01:30:00Z é 31/08 22:30 em São Paulo — mês anterior.
    expect(toSaoPauloMonthKey("2026-09-01T01:30:00.000Z")).toBe("2026-08");
  });
});

describe("purchasesInMonth / sumPurchasesTotalCents", () => {
  it("filtra pelo mês e soma em centavos inteiros", () => {
    const purchases = [
      purchase({ id: "a", date: "2026-09-05T12:00:00.000Z", totalCents: 5000 }),
      purchase({ id: "b", date: "2026-09-20T12:00:00.000Z", totalCents: 7000 }),
      purchase({ id: "c", date: "2026-08-20T12:00:00.000Z", totalCents: 9999 }),
    ];

    const inSeptember = purchasesInMonth(purchases, "2026-09");
    expect(inSeptember).toHaveLength(2);
    expect(sumPurchasesTotalCents(inSeptember)).toBe(12000);
  });
});

describe("aggregateCategorySpend", () => {
  it("soma só itens de carrinhos que viraram compra no mês, por categoria", () => {
    const purchases = [purchase({ id: "a", cartClientId: "cart-1" })];
    const cartItems = [
      { cartClientId: "cart-1", category: "hortifruti" as const, totalCents: 3000 },
      { cartClientId: "cart-1", category: "hortifruti" as const, totalCents: 2000 },
      { cartClientId: "cart-1", category: "carnes" as const, totalCents: 4000 },
      { cartClientId: "cart-other", category: "carnes" as const, totalCents: 9999 }, // fora do mês
    ];

    const result = aggregateCategorySpend(purchases, cartItems);
    expect(result).toEqual([
      { category: "hortifruti", totalCents: 5000 },
      { category: "carnes", totalCents: 4000 },
    ]);
  });
});

describe("shiftMonthKey", () => {
  it("anda mês a mês nos dois sentidos, virando o ano quando precisa", () => {
    expect(shiftMonthKey("2026-09", -1)).toBe("2026-08");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-09", 1)).toBe("2026-10");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });
});

describe("aggregateMonthlyEvolution", () => {
  it("devolve os últimos N meses em ordem crescente, com 0 quando não há compra", () => {
    const purchases = [
      purchase({ date: "2026-09-10T12:00:00.000Z", totalCents: 10000 }),
      purchase({ date: "2026-07-10T12:00:00.000Z", totalCents: 5000 }),
    ];

    const points = aggregateMonthlyEvolution(purchases, new Date("2026-09-15T12:00:00.000Z"), 3);
    expect(points).toEqual([
      { monthKey: "2026-07", totalCents: 5000 },
      { monthKey: "2026-08", totalCents: 0 },
      { monthKey: "2026-09", totalCents: 10000 },
    ]);
  });
});
