// LWW por campo (rules/mobile.md > Conflito) — porte 1:1 de
// `backend/src/api/services/sync/field_versions.py`. Lógica pura, sem SQLite:
// testável isolada (lib/sync/field-versions.test.ts) e reusada tanto para
// aplicar mutações locais quanto para mesclar mudanças vindas do pull.

export type FieldVersions = Record<string, string>; // campo → updated_at ISO 8601

export function parseFieldVersions(raw: string): FieldVersions {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" ? (parsed as FieldVersions) : {};
  } catch {
    return {};
  }
}

export function stringifyFieldVersions(versions: FieldVersions): string {
  return JSON.stringify(versions);
}

/** Marca os campos informados como alterados agora — usado ao gravar uma
 * mutação LOCAL (o próprio aparelho sempre vence o próprio histórico). */
export function bumpFieldVersions(
  current: FieldVersions,
  fields: readonly string[],
  updatedAt: string,
): FieldVersions {
  const next: FieldVersions = { ...current };
  for (const field of fields) next[field] = updatedAt;
  return next;
}

export interface FieldVersionsMergeResult {
  winningFields: Record<string, unknown>;
  winningVersions: FieldVersions;
}

/**
 * Decide quais campos de uma mudança recebida (pull do servidor, ou reaplicação
 * de uma mutação) vencem o LWW contra o que já está gravado localmente.
 *
 * Campo sem versão prévia sempre vence. Empate (`updatedAt == versão gravada`)
 * NÃO vence — mesma regra do backend, garante que reaplicar a mesma mudança
 * duas vezes é inócuo.
 */
export function mergeFieldVersions(
  existingVersions: FieldVersions,
  incomingFields: Record<string, unknown>,
  updatedAt: string,
): FieldVersionsMergeResult {
  const winningFields: Record<string, unknown> = {};
  const winningVersions: FieldVersions = {};
  const updatedAtMs = Date.parse(updatedAt);

  for (const [field, value] of Object.entries(incomingFields)) {
    const storedIso = existingVersions[field];
    const storedMs = storedIso ? Date.parse(storedIso) : null;
    if (storedMs !== null && updatedAtMs <= storedMs) continue;
    winningFields[field] = value;
    winningVersions[field] = updatedAt;
  }

  return { winningFields, winningVersions };
}
