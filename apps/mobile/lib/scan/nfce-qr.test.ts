import { describe, expect, it } from "vitest";

import { looksLikeNfceQr, validateNfceQr } from "./nfce-qr";

// Mesmas chaves de `backend/tests/test_receipts_routes.py` (DV mod11 calculado de verdade) —
// garante que a validação do app concorda byte-a-byte com o backend.
const VALID_GO_KEY = "52250911222333000181650010001234561123456786";
const NFE_MODEL_KEY = "52250911222333000181550010001234561123456783";

function qrUrlFor(key: string): string {
  return `https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=${key}|3|1`;
}

describe("validateNfceQr", () => {
  it("aceita uma URL de consulta válida (chave, modelo 65, DV certo)", () => {
    const result = validateNfceQr(qrUrlFor(VALID_GO_KEY));
    expect(result).toEqual({ valid: true, accessKey: VALID_GO_KEY, reason: "ok" });
  });

  it("aceita só o parâmetro p= (sem host)", () => {
    const result = validateNfceQr(`p=${VALID_GO_KEY}|3|1`);
    expect(result.valid).toBe(true);
    expect(result.accessKey).toBe(VALID_GO_KEY);
  });

  it("rejeita modelo 55 (NF-e, não NFC-e)", () => {
    const result = validateNfceQr(qrUrlFor(NFE_MODEL_KEY));
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("wrong-model");
  });

  it("rejeita dígito verificador errado", () => {
    const tampered = `${VALID_GO_KEY.slice(0, -1)}0`;
    const result = validateNfceQr(qrUrlFor(tampered === VALID_GO_KEY ? `${VALID_GO_KEY.slice(0, -1)}1` : tampered));
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid-check-digit");
  });

  it("rejeita QR que não é de nota nenhuma", () => {
    const result = validateNfceQr("7891000100103");
    expect(result).toEqual({ valid: false, accessKey: null, reason: "not-nfce" });
  });

  it("looksLikeNfceQr distingue chave de 44 dígitos de um EAN qualquer", () => {
    expect(looksLikeNfceQr(qrUrlFor(VALID_GO_KEY))).toBe(true);
    expect(looksLikeNfceQr("7891000100103")).toBe(false);
  });
});
