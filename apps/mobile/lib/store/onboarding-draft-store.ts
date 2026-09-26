import { create } from "zustand";

import { DEFAULT_CITY_SLUG } from "@/lib/mock/cities";

interface OnboardingDraftState {
  citySlug: string;
  familySize: number;
  monthlyBudgetCents: number;
  setCity: (citySlug: string) => void;
  setFamilySize: (familySize: number) => void;
  setMonthlyBudgetCents: (cents: number) => void;
  reset: () => void;
}

const INITIAL_FAMILY_SIZE = 2;
const INITIAL_BUDGET_CENTS = 150000;

/** Rascunho do onboarding — vive só durante o wizard, some ao concluir (vira `session-store`). */
export const useOnboardingDraftStore = create<OnboardingDraftState>((set) => ({
  citySlug: DEFAULT_CITY_SLUG,
  familySize: INITIAL_FAMILY_SIZE,
  monthlyBudgetCents: INITIAL_BUDGET_CENTS,
  setCity: (citySlug) => set({ citySlug }),
  setFamilySize: (familySize) => set({ familySize }),
  setMonthlyBudgetCents: (cents) => set({ monthlyBudgetCents: cents }),
  reset: () =>
    set({ citySlug: DEFAULT_CITY_SLUG, familySize: INITIAL_FAMILY_SIZE, monthlyBudgetCents: INITIAL_BUDGET_CENTS }),
}));
