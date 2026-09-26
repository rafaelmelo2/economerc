import { describe, expect, it } from "vitest";

import { computeGtinCheckDigit, isValidGtin, stripNonDigits, validateGtin } from "@/lib/scan/gtin";

describe("computeGtinCheckDigit", () => {
  it("computes the known EAN-13 check digit (4006381333931 → 1)", () => {
    expect(computeGtinCheckDigit("400638133393")).toBe(1);
  });
});

describe("validateGtin", () => {
  it("accepts a valid EAN-13", () => {
    expect(validateGtin("4006381333931")).toEqual({
      valid: true,
      code: "4006381333931",
      format: "ean13",
    });
  });

  it("rejects an EAN-13 with a tampered check digit", () => {
    const result = validateGtin("4006381333930");
    expect(result.valid).toBe(false);
    expect(result.format).toBe("ean13");
  });

  it("accepts a valid EAN-8 built from its own check digit", () => {
    const payload = "9638507";
    const check = computeGtinCheckDigit(payload);
    expect(validateGtin(`${payload}${check}`).valid).toBe(true);
  });

  it("accepts a valid UPC-A (12 digits) built from its own check digit", () => {
    const payload = "03600029145";
    const check = computeGtinCheckDigit(payload);
    const result = validateGtin(`${payload}${check}`);
    expect(result.valid).toBe(true);
    expect(result.format).toBe("upc_a");
  });

  it("strips non-digit characters (hyphens/spaces) before validating", () => {
    expect(validateGtin("4006-3813-3393-1").code).toBe("4006381333931");
    expect(validateGtin("4006-3813-3393-1").valid).toBe(true);
  });

  it("rejects codes with an unsupported length", () => {
    expect(validateGtin("123456").format).toBeNull();
    expect(validateGtin("123456").valid).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validateGtin("").valid).toBe(false);
  });
});

describe("isValidGtin", () => {
  it("mirrors validateGtin(...).valid", () => {
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("4006381333930")).toBe(false);
  });
});

describe("stripNonDigits", () => {
  it("keeps only digits", () => {
    expect(stripNonDigits("EAN: 789-100 010-0103")).toBe("7891000100103");
  });
});
