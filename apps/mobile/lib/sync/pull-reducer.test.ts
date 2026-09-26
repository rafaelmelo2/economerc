import { describe, expect, it } from "vitest";

import type { LocalEntitySnapshot, PulledChange } from "./pull-reducer";
import { applyPulledChange } from "./pull-reducer";

function change(overrides: Partial<PulledChange> = {}): PulledChange {
  return {
    entity: "cart",
    op: "upsert",
    clientId: "cart-1",
    updatedAt: "2026-09-26T12:00:00Z",
    fields: { status: "open" },
    ...overrides,
  };
}

describe("applyPulledChange", () => {
  it("cria snapshot novo quando não existe nada local", () => {
    const result = applyPulledChange(null, change());
    expect(result.changed).toBe(true);
    expect(result.fieldsToPersist).toEqual({ status: "open" });
    expect(result.fieldVersions).toEqual({ status: "2026-09-26T12:00:00Z" });
    expect(result.deletedAt).toBeNull();
  });

  it("aplica só os campos que vencem o LWW contra o que já está local", () => {
    const existing: LocalEntitySnapshot = {
      fieldVersions: { status: "2026-09-26T13:00:00Z", budget: "2026-09-26T08:00:00Z" },
      deletedAt: null,
    };
    const result = applyPulledChange(
      existing,
      change({ fields: { status: "closed", budget: "300.00" }, updatedAt: "2026-09-26T12:00:00Z" }),
    );
    // status local é mais novo (13h) que a mudança (12h) — não perde.
    // budget local é mais velho (8h) — perde.
    expect(result.fieldsToPersist).toEqual({ budget: "300.00" });
    expect(result.fieldVersions).toEqual({
      status: "2026-09-26T13:00:00Z",
      budget: "2026-09-26T12:00:00Z",
    });
    expect(result.changed).toBe(true);
  });

  it("descarta a mudança inteira quando nenhum campo vence", () => {
    const existing: LocalEntitySnapshot = {
      fieldVersions: { status: "2026-09-26T13:00:00Z" },
      deletedAt: null,
    };
    const result = applyPulledChange(existing, change({ updatedAt: "2026-09-26T10:00:00Z" }));
    expect(result.changed).toBe(false);
    expect(result.fieldsToPersist).toEqual({});
  });

  it("delete tombstona um registro existente", () => {
    const existing: LocalEntitySnapshot = {
      fieldVersions: { status: "2026-09-26T08:00:00Z" },
      deletedAt: null,
    };
    const result = applyPulledChange(
      existing,
      change({ op: "delete", fields: {}, updatedAt: "2026-09-26T12:00:00Z" }),
    );
    expect(result.changed).toBe(true);
    expect(result.deletedAt).toBe("2026-09-26T12:00:00Z");
  });

  it("tombstone é terminal — upsert atrasado depois do delete não ressuscita", () => {
    const existing: LocalEntitySnapshot = {
      fieldVersions: { status: "2026-09-26T08:00:00Z" },
      deletedAt: "2026-09-26T09:00:00Z",
    };
    const result = applyPulledChange(
      existing,
      change({ op: "upsert", fields: { status: "open" }, updatedAt: "2026-09-26T23:00:00Z" }),
    );
    expect(result.changed).toBe(false);
    expect(result.deletedAt).toBe("2026-09-26T09:00:00Z");
  });

  it("delete reaplicado sobre um já-tombstonado é inócuo", () => {
    const existing: LocalEntitySnapshot = {
      fieldVersions: {},
      deletedAt: "2026-09-26T09:00:00Z",
    };
    const result = applyPulledChange(existing, change({ op: "delete", fields: {} }));
    expect(result.changed).toBe(false);
    expect(result.deletedAt).toBe("2026-09-26T09:00:00Z");
  });
});
