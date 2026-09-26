import { create } from "zustand";

interface OnboardingDraftState {
  cityId: string | null;
  cityLabel: string | null;
  familySize: number;
  monthlyBudgetCents: number;
  setCity: (cityId: string, cityLabel: string) => void;
  setFamilySize: (familySize: number) => void;
  setMonthlyBudgetCents: (cents: number) => void;
  reset: () => void;
}

const INITIAL_FAMILY_SIZE = 2;
const INITIAL_BUDGET_CENTS = 150000;

/** Rascunho do onboarding — vive só durante o wizard, some ao concluir (vira
 * `session-store`). `cityId` é o UUID real de `GET /api/cities`; `cityLabel`
 * é só pra exibir sem precisar buscar a lista de novo em Perfil. */
export const useOnboardingDraftStore = create<OnboardingDraftState>((set) => ({
  cityId: null,
  cityLabel: null,
  familySize: INITIAL_FAMILY_SIZE,
  monthlyBudgetCents: INITIAL_BUDGET_CENTS,
  setCity: (cityId, cityLabel) => set({ cityId, cityLabel }),
  setFamilySize: (familySize) => set({ familySize }),
  setMonthlyBudgetCents: (cents) => set({ monthlyBudgetCents: cents }),
  reset: () =>
    set({
      cityId: null,
      cityLabel: null,
      familySize: INITIAL_FAMILY_SIZE,
      monthlyBudgetCents: INITIAL_BUDGET_CENTS,
    }),
}));
