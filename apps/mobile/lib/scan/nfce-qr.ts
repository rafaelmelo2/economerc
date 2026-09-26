// Detecção e validação do QR de NFC-e (consulta SEFAZ) — extração + validação da chave de
// acesso no app; o parse do CONTEÚDO da nota (mercado, itens, preços) é sempre do backend
// (`docs/nfce-sefaz-go.md` > Arquitetura). Espelha `backend/src/api/services/nfce/qr.py`
// (`parse_access_key`/`_mod11_check_digit`) — mesma regra dos dois lados, pra rejeitar QR
// óbviamente inválido (letra na chave, NF-e modelo 55, dígito verificador errado) antes de
// gastar uma chamada de rede.
//
// Formato do parâmetro `p` (QR v2/v3, qualquer UF): `<chave_acesso 44 dígitos>|<versao>|<tpAmb>...`.

const ACCESS_KEY_LENGTH = 44;
const NFCE_MODEL = "65";
const NFE_MODEL = "55";
const NFCE_QUERY_PARAM_PATTERN = new RegExp(`[?&]p=([^&]+)`);
const DIGITS_ONLY_PATTERN = /^\d+$/;
const MOD11_WEIGHTS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export type NfceQrValidationReason =
  | "ok"
  | "not-nfce" // não parece um QR de nota (sem chave de 44 dígitos reconhecível)
  | "wrong-model" // é uma chave de NF-e (modelo 55), não de NFC-e
  | "invalid-check-digit"; // 44 dígitos, modelo certo, mas o DV não bate

export interface NfceQrValidation {
  valid: boolean;
  accessKey: string | null;
  reason: NfceQrValidationReason;
}

/** Extrai o valor bruto do parâmetro `p` (ou o texto inteiro, se o QR já for só a chave). */
function extractRawKeyCandidate(qrValue: string): string | null {
  const trimmed = qrValue.trim();
  const paramMatch = trimmed.match(NFCE_QUERY_PARAM_PATTERN);
  const pValue = paramMatch ? decodeURIComponent(paramMatch[1] ?? "") : trimmed;
  const firstField = pValue.split("|")[0] ?? "";
  const digitsOnly = firstField.replace(/\D/g, "");
  return digitsOnly.length > 0 ? digitsOnly : null;
}

/** Dígito verificador módulo 11 da chave de acesso (peso 2–9 cíclico, da direita) — igual ao
 * `_mod11_check_digit` do backend. */
function computeAccessKeyCheckDigit(payloadDigits: string): number {
  let total = 0;
  const reversed = payloadDigits.split("").reverse();
  for (let index = 0; index < reversed.length; index += 1) {
    const digit = Number(reversed[index]);
    const weight = MOD11_WEIGHTS[index % MOD11_WEIGHTS.length]!;
    total += digit * weight;
  }
  const remainder = total % 11;
  return remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
}

/** Valida tamanho, modelo (65 = NFC-e) e dígito verificador — a MESMA checagem que o backend
 * repete em `POST /receipts`. Rejeitar aqui evita gastar uma chamada de rede num QR qualquer. */
export function validateNfceQr(qrValue: string): NfceQrValidation {
  const candidate = extractRawKeyCandidate(qrValue);
  if (candidate === null || candidate.length !== ACCESS_KEY_LENGTH || !DIGITS_ONLY_PATTERN.test(candidate)) {
    return { valid: false, accessKey: null, reason: "not-nfce" };
  }

  const model = candidate.slice(20, 22);
  if (model !== NFCE_MODEL) {
    return {
      valid: false,
      accessKey: candidate,
      reason: model === NFE_MODEL ? "wrong-model" : "not-nfce",
    };
  }

  const expectedCheckDigit = computeAccessKeyCheckDigit(candidate.slice(0, 43));
  if (String(expectedCheckDigit) !== candidate.charAt(43)) {
    return { valid: false, accessKey: candidate, reason: "invalid-check-digit" };
  }

  return { valid: true, accessKey: candidate, reason: "ok" };
}

/** `true` quando o QR ao menos *parece* uma nota (44 dígitos reconhecíveis) — usado para decidir
 * a mensagem de erro certa (nota inválida vs. "não reconhecemos esse QR code"). */
export function looksLikeNfceQr(qrValue: string): boolean {
  return extractRawKeyCandidate(qrValue)?.length === ACCESS_KEY_LENGTH;
}
