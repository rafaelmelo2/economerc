import { Redirect } from "expo-router";

import { useSessionStore } from "@/lib/store/session-store";

/**
 * Guard de entrada — síncrono, sem backend (onda 1). Onda 3 troca por sessão real
 * (access em memória + refresh em `expo-secure-store`).
 */
export default function Index() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const onboardingComplete = useSessionStore((state) => state.onboardingComplete);

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  if (!onboardingComplete) return <Redirect href="/(onboarding)/city" />;
  return <Redirect href="/(tabs)" />;
}
