// Detecção de QR de NFC-e (consulta SEFAZ) — só a extração da chave de acesso, sem parse de
// conteúdo (isso é do backend, ver `docs/nfce-sefaz-go.md`). A Onda 5 implementa o fluxo de
// nota; por ora o app só reconhece o QR e mostra "Leitura de nota chega em breve".
//
// Formato do parâmetro `p` (QR v2/v3, qualquer UF): `<chave_acesso 44 dígitos>|<versao>|<tpAmb>...`.
// Detectamos pela presença de `p=<44 dígitos>` na query string — não fixamos host (SEFAZ-GO hoje,
// outras UFs depois) nem versão do QR.

const ACCESS_KEY_LENGTH = 44;
const NFCE_QUERY_PARAM_PATTERN = new RegExp(`[?&]p=(\\d{${ACCESS_KEY_LENGTH}})`);

export function extractNfceAccessKey(qrValue: string): string | null {
  const match = qrValue.match(NFCE_QUERY_PARAM_PATTERN);
  return match?.[1] ?? null;
}

export function isNfceQrValue(qrValue: string): boolean {
  return extractNfceAccessKey(qrValue) !== null;
}
