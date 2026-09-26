// Estado observável do motor de sync (rules/mobile.md > outbox: "estado
// exposto para a UI mostrar"). Zustand simples — a UI (3B/perfil) assina só o
// que precisa (`status`, `pendingCount`).

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastError: string | null;
  lastSyncedAt: string | null;
}

interface SyncStateActions {
  setStatus: (status: SyncStatus) => void;
  setPendingCount: (count: number) => void;
  setLastError: (error: string | null) => void;
  setLastSyncedAt: (at: string) => void;
}

export const useSyncStateStore = create<SyncState & SyncStateActions>((set) => ({
  status: "idle",
  pendingCount: 0,
  lastError: null,
  lastSyncedAt: null,
  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastError: (lastError) => set({ lastError }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
}));

/** Hook público pra UI (perfil, barra de status) — só leitura, `useShallow`
 * evita re-render a cada tick só porque o seletor devolve objeto novo. */
export function useSyncStatus(): SyncState {
  return useSyncStateStore(
    useShallow((state) => ({
      status: state.status,
      pendingCount: state.pendingCount,
      lastError: state.lastError,
      lastSyncedAt: state.lastSyncedAt,
    })),
  );
}
