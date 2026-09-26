// Sessão real (rules/mobile.md > Auth): Google/Apple/dev trocam token no
// backend, refresh vive em expo-secure-store, e um snapshot (nome, onboarding)
// fica em cache local (`local_kv`) pra decidir "autenticado + onboarding
// completo" mesmo em modo avião logo depois de abrir o app.
//
// Contrato preservado pro resto do app (NÃO mude nomes sem checar
// `app/(tabs)/index.tsx` e `app/(tabs)/_layout.tsx`, que são do bloco 3B):
// `isAuthenticated`, `onboardingComplete`, `onboarding.monthlyBudgetCents`.

import { create } from "zustand";

import { loginDev, loginWithApple, loginWithGoogle, logoutSession } from "@/lib/api/auth";
import { deleteMyAccount, getMe, updatePreferences } from "@/lib/api/me";
import { signInWithApple as nativeAppleSignIn } from "@/lib/auth/apple-signin";
import { signInWithGoogle as nativeGoogleSignIn, signOutFromGoogle } from "@/lib/auth/google-signin";
import { refreshSessionOnce, registerSessionExpiredHandler } from "@/lib/auth/refresh-lock";
import {
  clearInMemoryAccessToken,
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setAccessToken,
  setStoredRefreshToken,
} from "@/lib/auth/token-store";
import { setCartBudget } from "@/lib/cart/contract";
import { getDb } from "@/lib/db/client";
import { deleteLocalKv, getLocalKv, setLocalKv } from "@/lib/db/local-kv-repository";
import { centsToDecimalString, decimalStringToCents } from "@/lib/sync/money";

export type AuthProvider = "google" | "apple" | "dev";

export interface OnboardingData {
  cityId: string | null;
  cityLabel: string | null;
  familySize: number;
  monthlyBudgetCents: number;
}

const DEFAULT_ONBOARDING: OnboardingData = {
  cityId: null,
  cityLabel: null,
  familySize: 2,
  monthlyBudgetCents: 150000,
};

const SESSION_CACHE_KEY = "session_cache_v1";

interface SessionCacheSnapshot {
  provider: AuthProvider | null;
  userName: string | null;
  userId: string | null;
  onboardingComplete: boolean;
  onboarding: OnboardingData;
}

const SIGNED_OUT_SNAPSHOT: SessionCacheSnapshot = {
  provider: null,
  userName: null,
  userId: null,
  onboardingComplete: false,
  onboarding: DEFAULT_ONBOARDING,
};

interface SessionState extends SessionCacheSnapshot {
  isAuthenticated: boolean;
  isBootstrapping: boolean;
}

interface SessionActions {
  bootstrap: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInDev: () => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  updateMonthlyBudget: (monthlyBudgetCents: number) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  forceSignOut: () => void;
}

async function loadOnboardingFromServer(): Promise<{
  onboardingComplete: boolean;
  onboarding: OnboardingData;
}> {
  const me = await getMe();
  const prefs = me.preferences;
  const hasOnboarded = prefs !== null && prefs.cityId !== null && prefs.monthlyBudget !== null;
  return {
    onboardingComplete: hasOnboarded,
    onboarding: {
      cityId: prefs?.cityId ?? null,
      cityLabel: null, // resolvido pela tela de cidade (lista + cache), não pelo /me
      familySize: prefs?.householdSize ?? DEFAULT_ONBOARDING.familySize,
      monthlyBudgetCents:
        prefs?.monthlyBudget != null
          ? decimalStringToCents(prefs.monthlyBudget)
          : DEFAULT_ONBOARDING.monthlyBudgetCents,
    },
  };
}

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  isAuthenticated: false,
  isBootstrapping: true,
  ...SIGNED_OUT_SNAPSHOT,

  bootstrap: async () => {
    const db = getDb();
    const cached = getLocalKv<SessionCacheSnapshot>(db, SESSION_CACHE_KEY);
    if (cached) {
      set({ isAuthenticated: true, ...cached });
    }

    const pair = await refreshSessionOnce();
    if (pair === null) {
      get().forceSignOut();
      return;
    }

    try {
      const { onboardingComplete, onboarding } = await loadOnboardingFromServer();
      const snapshot: SessionCacheSnapshot = {
        provider: cached?.provider ?? null,
        userName: pair.user.displayName ?? pair.user.email ?? cached?.userName ?? null,
        userId: pair.user.id,
        onboardingComplete,
        onboarding,
      };
      setLocalKv(db, SESSION_CACHE_KEY, snapshot);
      set({ isAuthenticated: true, ...snapshot, isBootstrapping: false });
    } catch {
      // Sem rede logo após restaurar o token: segue com o cache local (se
      // havia) — nunca trava a UI esperando a rede (rules/mobile.md).
      if (!cached) {
        set({
          isAuthenticated: true,
          userId: pair.user.id,
          userName: pair.user.displayName ?? pair.user.email ?? null,
        });
      }
      set({ isBootstrapping: false });
    }
  },

  signInWithGoogle: async () => {
    const { idToken } = await nativeGoogleSignIn();
    const pair = await loginWithGoogle(idToken);
    await afterLogin(set, pair.accessToken, pair.refreshToken, pair.user, "google");
  },

  signInWithApple: async () => {
    const { identityToken, fullName } = await nativeAppleSignIn();
    const pair = await loginWithApple(identityToken, fullName);
    await afterLogin(set, pair.accessToken, pair.refreshToken, pair.user, "apple");
  },

  signInDev: async () => {
    const pair = await loginDev();
    await afterLogin(set, pair.accessToken, pair.refreshToken, pair.user, "dev");
  },

  completeOnboarding: async (data) => {
    set({ onboardingComplete: true, onboarding: data });
    void setCartBudget(data.monthlyBudgetCents);
    const snapshot: SessionCacheSnapshot = {
      provider: get().provider,
      userName: get().userName,
      userId: get().userId,
      onboardingComplete: true,
      onboarding: data,
    };
    setLocalKv(getDb(), SESSION_CACHE_KEY, snapshot);
    try {
      await updatePreferences({
        cityId: data.cityId,
        householdSize: data.familySize,
        monthlyBudget: centsToDecimalString(data.monthlyBudgetCents),
      });
    } catch {
      // Offline: o cache local já reflete a escolha do usuário; a próxima
      // chamada de rede reconcilia (não há outbox pra `/me/preferences`).
    }
  },

  /** Editar orçamento em Perfil — mesma mecânica do onboarding, sem mexer nos
   * outros campos (`get().onboarding` preserva `cityId`/`cityLabel`/`familySize`). */
  updateMonthlyBudget: async (monthlyBudgetCents) => {
    const nextOnboarding: OnboardingData = { ...get().onboarding, monthlyBudgetCents };
    set({ onboarding: nextOnboarding });
    void setCartBudget(monthlyBudgetCents);
    setLocalKv(getDb(), SESSION_CACHE_KEY, {
      provider: get().provider,
      userName: get().userName,
      userId: get().userId,
      onboardingComplete: get().onboardingComplete,
      onboarding: nextOnboarding,
    });
    try {
      await updatePreferences({ monthlyBudget: centsToDecimalString(monthlyBudgetCents) });
    } catch {
      // Offline — mesma lógica de `completeOnboarding` acima.
    }
  },

  signOut: async () => {
    const refreshToken = await getStoredRefreshToken();
    if (refreshToken) await logoutSession(refreshToken);
    await signOutFromGoogle();
    await clearStoredRefreshToken();
    clearInMemoryAccessToken();
    deleteLocalKv(getDb(), SESSION_CACHE_KEY);
    set({ isAuthenticated: false, ...SIGNED_OUT_SNAPSHOT });
  },

  deleteAccount: async () => {
    await deleteMyAccount();
    await get().signOut();
  },

  forceSignOut: () => {
    clearInMemoryAccessToken();
    void clearStoredRefreshToken();
    try {
      deleteLocalKv(getDb(), SESSION_CACHE_KEY);
    } catch {
      // sem-op — melhor esforço
    }
    set({ isAuthenticated: false, isBootstrapping: false, ...SIGNED_OUT_SNAPSHOT });
  },
}));

async function afterLogin(
  set: (partial: Partial<SessionState>) => void,
  accessToken: string,
  refreshToken: string | null,
  user: { id: string; displayName: string | null; email: string | null },
  provider: AuthProvider,
): Promise<void> {
  setAccessToken(accessToken);
  if (refreshToken) await setStoredRefreshToken(refreshToken);

  let onboardingComplete = false;
  let onboarding = DEFAULT_ONBOARDING;
  try {
    const loaded = await loadOnboardingFromServer();
    onboardingComplete = loaded.onboardingComplete;
    onboarding = loaded.onboarding;
  } catch {
    // Login em si já exige rede — chegar aqui sem conseguir buscar
    // preferências é raro; segue pro onboarding padrão.
  }

  const snapshot: SessionCacheSnapshot = {
    provider,
    userName: user.displayName ?? user.email ?? null,
    userId: user.id,
    onboardingComplete,
    onboarding,
  };
  setLocalKv(getDb(), SESSION_CACHE_KEY, snapshot);
  set({ isAuthenticated: true, ...snapshot });
}

registerSessionExpiredHandler(() => {
  useSessionStore.getState().forceSignOut();
});
