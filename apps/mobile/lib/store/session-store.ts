import { create } from "zustand";

import { DEFAULT_CITY_SLUG } from "@/lib/mock/cities";

export type AuthProvider = "google" | "apple";

export interface OnboardingData {
  citySlug: string;
  familySize: number;
  monthlyBudgetCents: number;
}

interface SessionState {
  isAuthenticated: boolean;
  provider: AuthProvider | null;
  userName: string | null;
  onboardingComplete: boolean;
  onboarding: OnboardingData;
  signIn: (provider: AuthProvider) => void;
  completeOnboarding: (data: OnboardingData) => void;
  signOut: () => void;
  deleteAccount: () => void;
}

const DEFAULT_ONBOARDING: OnboardingData = {
  citySlug: DEFAULT_CITY_SLUG,
  familySize: 2,
  monthlyBudgetCents: 150000,
};

export const useSessionStore = create<SessionState>((set) => ({
  isAuthenticated: false,
  provider: null,
  userName: null,
  onboardingComplete: false,
  onboarding: DEFAULT_ONBOARDING,

  // TODO onda 3: login real (troca do id_token do provedor no backend via JWKS)
  signIn: (provider) =>
    set({
      isAuthenticated: true,
      provider,
      userName: provider === "google" ? "Ana Souza" : "Ana",
    }),

  completeOnboarding: (data) => set({ onboardingComplete: true, onboarding: data }),

  signOut: () =>
    set({
      isAuthenticated: false,
      provider: null,
      userName: null,
      onboardingComplete: false,
      onboarding: DEFAULT_ONBOARDING,
    }),

  deleteAccount: () =>
    set({
      isAuthenticated: false,
      provider: null,
      userName: null,
      onboardingComplete: false,
      onboarding: DEFAULT_ONBOARDING,
    }),
}));
