// Aplica uma mudança de `GET /sync/pull` contra o estado local — lógica pura
// (sem SQLite), espelhando `backend/src/api/services/sync/sync_service.py`:
// tombstone é terminal, upsert é LWW por campo via `mergeFieldVersions`.
// `lib/db/*-repository.ts` é quem persiste o resultado desta função.

import { type FieldVersions, mergeFieldVersions } from "@/lib/db/field-versions";

export interface PulledChange {
  entity: "cart" | "cart_item";
  op: "upsert" | "delete";
  clientId: string;
  updatedAt: string;
  fields: Record<string, unknown>;
}

export interface LocalEntitySnapshot {
  fieldVersions: FieldVersions;
  deletedAt: string | null;
}

export interface ApplyPulledChangeResult {
  /** Só os campos que o pull realmente atualiza — vazio quando a mudança foi
   * descartada (LWW perdeu, ou tombstone já era terminal). */
  fieldsToPersist: Record<string, unknown>;
  fieldVersions: FieldVersions;
  deletedAt: string | null;
  changed: boolean;
}

const NO_OP_RESULT = (existing: LocalEntitySnapshot | null): ApplyPulledChangeResult => ({
  fieldsToPersist: {},
  fieldVersions: existing?.fieldVersions ?? {},
  deletedAt: existing?.deletedAt ?? null,
  changed: false,
});

export function applyPulledChange(
  existing: LocalEntitySnapshot | null,
  change: PulledChange,
): ApplyPulledChangeResult {
  const alreadyTombstoned = existing?.deletedAt != null;

  if (change.op === "delete") {
    if (alreadyTombstoned) return NO_OP_RESULT(existing);
    return {
      fieldsToPersist: {},
      fieldVersions: existing?.fieldVersions ?? {},
      deletedAt: change.updatedAt,
      changed: true,
    };
  }

  // Tombstone é terminal (mesma regra do backend) — upsert atrasado não ressuscita.
  if (alreadyTombstoned) return NO_OP_RESULT(existing);

  const { winningFields, winningVersions } = mergeFieldVersions(
    existing?.fieldVersions ?? {},
    change.fields,
    change.updatedAt,
  );
  if (Object.keys(winningFields).length === 0) return NO_OP_RESULT(existing);

  return {
    fieldsToPersist: winningFields,
    fieldVersions: { ...(existing?.fieldVersions ?? {}), ...winningVersions },
    deletedAt: null,
    changed: true,
  };
}
