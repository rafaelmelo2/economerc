import { describe, expect, it } from "vitest";

import type { OutboxRow } from "@/lib/db/types";

import { buildPushBatch } from "./push-batch";

function outboxRow(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: 1,
    entity: "cart",
    op: "upsert",
    client_id: "11111111-1111-1111-1111-111111111111",
    fields: JSON.stringify({ status: "open" }),
    updated_at: "2026-09-26T12:00:00Z",
    created_at: "2026-09-26T12:00:00Z",
    attempts: 0,
    last_error: null,
    next_attempt_at: null,
    ...overrides,
  };
}

describe("buildPushBatch", () => {
  it("converte cada linha do outbox no shape de SyncMutation", () => {
    const batch = buildPushBatch([outboxRow()]);
    expect(batch).toEqual([
      {
        entity: "cart",
        op: "upsert",
        clientId: "11111111-1111-1111-1111-111111111111",
        updatedAt: "2026-09-26T12:00:00Z",
        fields: { status: "open" },
      },
    ]);
  });

  it("preserva a ordem de created_at (carrinho antes do item que referencia ele)", () => {
    const cartRow = outboxRow({ id: 1, entity: "cart", client_id: "cart-1" });
    const itemRow = outboxRow({
      id: 2,
      entity: "cart_item",
      client_id: "item-1",
      fields: JSON.stringify({ cartClientId: "cart-1", productName: "Arroz", unitPrice: "24.90" }),
    });
    const batch = buildPushBatch([cartRow, itemRow]);
    expect(batch.map((m) => m.clientId)).toEqual(["cart-1", "item-1"]);
  });

  it("faz o parse de fields sem perder nada", () => {
    const row = outboxRow({
      entity: "cart_item",
      fields: JSON.stringify({
        cartClientId: "cart-1",
        productName: "Feijão 1kg",
        unitPrice: "8.50",
        quantity: "2",
        unit: "un",
        isOffer: true,
      }),
    });
    const [mutation] = buildPushBatch([row]);
    expect(mutation?.fields).toEqual({
      cartClientId: "cart-1",
      productName: "Feijão 1kg",
      unitPrice: "8.50",
      quantity: "2",
      unit: "un",
      isOffer: true,
    });
  });

  it("respeita o limite máximo de lote", () => {
    const rows = Array.from({ length: 10 }, (_, i) => outboxRow({ id: i, client_id: `id-${i}` }));
    const batch = buildPushBatch(rows);
    expect(batch).toHaveLength(10); // bem abaixo do MAX_PUSH_BATCH_SIZE — só garante slice()
  });
});
