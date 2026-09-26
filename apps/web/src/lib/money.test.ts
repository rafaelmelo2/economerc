import { describe, expect, it } from "vitest";

import { formatDecimalBRL, formatMoneyBRL, formatMoneyFromApi, formatMoneyPerUnit } from "@/lib/money";

// `Intl.NumberFormat("pt-BR", { style: "currency" })` separa "R$" do valor com um espaço
// NÃO-quebrável (U+00A0), não um espaço comum — usar " " no literal do teste falha por engano.
const NBSP = " ";

describe("formatMoneyBRL", () => {
  it("formata em pt-BR com símbolo", () => {
    expect(formatMoneyBRL(1234.56)).toBe(`R$${NBSP}1.234,56`);
  });

  it("arredonda para duas casas", () => {
    expect(formatMoneyBRL(9.999)).toBe(`R$${NBSP}10,00`);
  });
});

describe("formatDecimalBRL", () => {
  it("formata sem símbolo", () => {
    expect(formatDecimalBRL(1234.5)).toBe("1.234,50");
  });
});

describe("formatMoneyPerUnit", () => {
  it("anexa a unidade", () => {
    expect(formatMoneyPerUnit(8.9, "kg")).toBe(`R$${NBSP}8,90/kg`);
  });
});

describe("formatMoneyFromApi", () => {
  it("converte a string decimal da API (nunca float na origem) para exibição", () => {
    expect(formatMoneyFromApi("82.40")).toBe(`R$${NBSP}82,40`);
  });

  it("lida com zero", () => {
    expect(formatMoneyFromApi("0")).toBe(`R$${NBSP}0,00`);
  });
});
