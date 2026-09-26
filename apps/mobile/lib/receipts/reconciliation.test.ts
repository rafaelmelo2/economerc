import { describe, expect, it } from "vitest";

import {
  compareCartAndReceiptItems,
  type CartForReconciliation,
  joinCartsAndReceipts,
  type ReceiptForReconciliation,
} from "./reconciliation";

function cart(overrides: Partial<CartForReconciliation> = {}): CartForReconciliation {
  return {
    clientId: "cart-1",
    marketId: null,
    marketName: null,
    closedAt: "2026-09-20T18:00:00.000Z",
    totalCents: 21477,
    itemCount: 23,
    ...overrides,
  };
}

function receipt(overrides: Partial<ReceiptForReconciliation> = {}): ReceiptForReconciliation {
  return {
    clientId: "receipt-1",
    marketId: null,
    marketName: null,
    issuedAt: "2026-09-20T18:05:00.000Z",
    totalAmountCents: 21477,
    itemCount: 23,
    ...overrides,
  };
}

describe("joinCartsAndReceipts", () => {
  it("casa carrinho e nota do mesmo dia e mesmo marketId, preferindo o total da nota", () => {
    const purchases = joinCartsAndReceipts(
      [cart({ marketId: "market-1", totalCents: 21000 })],
      [receipt({ marketId: "market-1", totalAmountCents: 21477 })],
    );

    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({
      source: "matched",
      totalCents: 21477,
      cartClientId: "cart-1",
      receiptClientId: "receipt-1",
    });
  });

  it("casa por nome do mercado (case-insensitive) quando marketId está ausente", () => {
    const purchases = joinCartsAndReceipts(
      [cart({ marketName: "  Bom Preço  " })],
      [receipt({ marketName: "bom preço" })],
    );

    expect(purchases).toHaveLength(1);
    expect(purchases[0]?.source).toBe("matched");
  });

  it("casa por heurística de dia único quando sobra 1 carrinho e 1 nota sem mercado", () => {
    const purchases = joinCartsAndReceipts([cart()], [receipt()]);

    expect(purchases).toHaveLength(1);
    expect(purchases[0]?.source).toBe("matched");
  });

  it("NÃO casa quando há mais de um carrinho/nota no mesmo dia sem sinal de mercado", () => {
    const purchases = joinCartsAndReceipts(
      [cart({ clientId: "cart-1" }), cart({ clientId: "cart-2" })],
      [receipt({ clientId: "receipt-1" })],
    );

    expect(purchases).toHaveLength(3);
    expect(purchases.every((purchase) => purchase.source !== "matched")).toBe(true);
  });

  it("carrinho e nota em dias diferentes viram compras separadas", () => {
    const purchases = joinCartsAndReceipts(
      [cart({ closedAt: "2026-09-20T18:00:00.000Z" })],
      [receipt({ issuedAt: "2026-09-21T18:00:00.000Z" })],
    );

    expect(purchases).toHaveLength(2);
    expect(purchases.map((purchase) => purchase.source).sort()).toEqual(["cart", "receipt"]);
  });

  it("ordena as compras da mais recente para a mais antiga", () => {
    const purchases = joinCartsAndReceipts(
      [
        cart({ clientId: "old", closedAt: "2026-09-01T12:00:00.000Z", marketId: "m" }),
        cart({ clientId: "new", closedAt: "2026-09-25T12:00:00.000Z", marketId: "m2" }),
      ],
      [],
    );

    expect(purchases.map((purchase) => purchase.cartClientId)).toEqual(["new", "old"]);
  });
});

describe("compareCartAndReceiptItems", () => {
  it("casa por EAN e reporta só quem sobra de cada lado", () => {
    const result = compareCartAndReceiptItems(
      [
        { ean: "789", productName: "Café Pilão 500 g" },
        { ean: null, productName: "Tomate salada" },
      ],
      [
        { ean: "789", rawName: "CAFE PILAO 500G" },
        { ean: null, rawName: "Sabão em pó" },
      ],
    );

    expect(result.onlyInCart).toEqual(["Tomate salada"]);
    expect(result.onlyInReceipt).toEqual(["Sabão em pó"]);
  });

  it("casa por nome normalizado quando não há EAN", () => {
    const result = compareCartAndReceiptItems(
      [{ ean: null, productName: "Arroz Branco 5kg" }],
      [{ ean: null, rawName: "arroz branco 5kg" }],
    );

    expect(result.onlyInCart).toEqual([]);
    expect(result.onlyInReceipt).toEqual([]);
  });
});
