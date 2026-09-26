// Validação de GTIN (EAN-13/UPC-A/EAN-8/GTIN-14) — dígito verificador GS1.
//
// A fórmula é a MESMA para qualquer tamanho de código: pesos 3/1 alternados a partir do
// dígito imediatamente à esquerda do verificador (âncora na ponta direita), então o mesmo
// `computeGtinCheckDigit` serve EAN-8, UPC-A (12), EAN-13 e GTIN-14 sem ramificação por tamanho.
// Só EAN-13/UPC-A/EAN-8 chegam da câmera (ver `.claude/rules/mobile.md` → Scan); GTIN-14 fica
// aqui por completude (embalagem/caixa fechada, fora do escopo da Fase 1).

export type GtinFormat = "ean8" | "upc_a" | "ean13" | "gtin14";

const FORMAT_BY_LENGTH: Record<number, GtinFormat> = {
  8: "ean8",
  12: "upc_a",
  13: "ean13",
  14: "gtin14",
};

export interface GtinValidation {
  valid: boolean;
  /** Código normalizado (só dígitos), mesmo quando inválido — útil pra exibir o que foi lido. */
  code: string;
  format: GtinFormat | null;
}

export function stripNonDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Dígito verificador esperado para o payload (código SEM o último dígito). */
export function computeGtinCheckDigit(payloadDigits: string): number {
  const digits = payloadDigits.split("").map(Number);
  let weightedSum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const positionFromRight = digits.length - index;
    const weight = positionFromRight % 2 === 1 ? 3 : 1;
    weightedSum += (digits[index] ?? 0) * weight;
  }
  return (10 - (weightedSum % 10)) % 10;
}

export function validateGtin(raw: string): GtinValidation {
  const code = stripNonDigits(raw);
  const format = FORMAT_BY_LENGTH[code.length] ?? null;

  if (format === null) {
    return { valid: false, code, format: null };
  }

  const payload = code.slice(0, -1);
  const checkDigit = Number(code.slice(-1));
  const valid = computeGtinCheckDigit(payload) === checkDigit;

  return { valid, code, format };
}

export function isValidGtin(raw: string): boolean {
  return validateGtin(raw).valid;
}
