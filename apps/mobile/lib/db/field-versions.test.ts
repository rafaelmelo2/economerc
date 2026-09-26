import { describe, expect, it } from "vitest";

import { bumpFieldVersions, mergeFieldVersions, parseFieldVersions, stringifyFieldVersions } from "./field-versions";

describe("mergeFieldVersions (LWW por campo)", () => {
  it("campo sem versão prévia sempre vence", () => {
    const { winningFields, winningVersions } = mergeFieldVersions(
      {},
      { unitPrice: "19.90" },
      "2026-09-26T12:00:00Z",
    );
    expect(winningFields).toEqual({ unitPrice: "19.90" });
    expect(winningVersions).toEqual({ unitPrice: "2026-09-26T12:00:00Z" });
  });

  it("mudança mais nova vence uma versão gravada mais velha", () => {
    const existing = { unitPrice: "2026-09-26T10:00:00Z" };
    const { winningFields } = mergeFieldVersions(
      existing,
      { unitPrice: "20.00" },
      "2026-09-26T12:00:00Z",
    );
    expect(winningFields).toEqual({ unitPrice: "20.00" });
  });

  it("mudança mais velha NÃO vence uma versão já mais nova", () => {
    const existing = { unitPrice: "2026-09-26T12:00:00Z" };
    const { winningFields, winningVersions } = mergeFieldVersions(
      existing,
      { unitPrice: "20.00" },
      "2026-09-26T10:00:00Z",
    );
    expect(winningFields).toEqual({});
    expect(winningVersions).toEqual({});
  });

  it("empate (mesmo updatedAt) NÃO vence — reenviar o mesmo lote é inócuo", () => {
    const existing = { unitPrice: "2026-09-26T12:00:00Z" };
    const { winningFields } = mergeFieldVersions(
      existing,
      { unitPrice: "20.00" },
      "2026-09-26T12:00:00Z",
    );
    expect(winningFields).toEqual({});
  });

  it("mescla campo a campo — cada um resolve contra a própria versão", () => {
    const existing = {
      unitPrice: "2026-09-26T12:00:00Z",
      quantity: "2026-09-26T08:00:00Z",
    };
    const { winningFields } = mergeFieldVersions(
      existing,
      { unitPrice: "20.00", quantity: "2" }, // unitPrice é mais velho, quantity é mais novo
      "2026-09-26T10:00:00Z",
    );
    expect(winningFields).toEqual({ quantity: "2" });
  });
});

describe("bumpFieldVersions", () => {
  it("marca só os campos informados", () => {
    const result = bumpFieldVersions({ a: "t0" }, ["b", "c"], "t1");
    expect(result).toEqual({ a: "t0", b: "t1", c: "t1" });
  });
});

describe("parseFieldVersions / stringifyFieldVersions", () => {
  it("faz round-trip e nunca lança em JSON inválido", () => {
    const versions = { unitPrice: "2026-09-26T12:00:00Z" };
    expect(parseFieldVersions(stringifyFieldVersions(versions))).toEqual(versions);
    expect(parseFieldVersions("not json")).toEqual({});
  });
});
