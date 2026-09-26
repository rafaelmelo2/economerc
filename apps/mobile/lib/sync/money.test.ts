import { describe, expect, it } from "vitest";

import {
  centsToDecimalString,
  decimalStringToCents,
  decimalStringToMilli,
  milliToDecimalString,
} from "./money";

describe("centsToDecimalString", () => {
  it("formata reais e centavos com 2 casas", () => {
    expect(centsToDecimalString(1990)).toBe("19.90");
    expect(centsToDecimalString(5)).toBe("0.05");
    expect(centsToDecimalString(0)).toBe("0.00");
    expect(centsToDecimalString(100000)).toBe("1000.00");
  });
});

describe("decimalStringToCents", () => {
  it("é o inverso exato de centsToDecimalString", () => {
    for (const cents of [0, 5, 50, 1990, 100000, 1]) {
      expect(decimalStringToCents(centsToDecimalString(cents))).toBe(cents);
    }
  });

  it("aceita string sem parte decimal", () => {
    expect(decimalStringToCents("19")).toBe(1900);
  });

  it("nunca passa por float — string longa não perde precisão", () => {
    // 0.1 + 0.2 em float dá 0.30000000000000004; aqui não existe soma float.
    expect(decimalStringToCents("0.10")).toBe(10);
    expect(decimalStringToCents("0.20")).toBe(20);
  });
});

describe("milliToDecimalString", () => {
  it("formata quantidade em milésimos sem zeros à direita", () => {
    expect(milliToDecimalString(1000)).toBe("1");
    expect(milliToDecimalString(1400)).toBe("1.4");
    expect(milliToDecimalString(1050)).toBe("1.05");
    expect(milliToDecimalString(500)).toBe("0.5");
  });
});

describe("decimalStringToMilli", () => {
  it("é o inverso exato de milliToDecimalString", () => {
    for (const milli of [1000, 1400, 1050, 500, 2]) {
      expect(decimalStringToMilli(milliToDecimalString(milli))).toBe(milli);
    }
  });

  it("aceita string inteira (1 unidade)", () => {
    expect(decimalStringToMilli("1")).toBe(1000);
  });
});
