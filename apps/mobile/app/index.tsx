import { Redirect } from "expo-router";

import { useSessionStore } from "@/lib/store/session-store";

/**
 * Guard de entrada — lê o `session-store` já hidratado pelo bootstrap de
 * `app/_layout.tsx` (o `Stack` só monta depois que a sessão foi decidida).
 */
export default function Index() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const onboardingComplete = useSessionStore((state) => state.onboardingComplete);

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  if (!onboardingComplete) return <Redirect href="/(onboarding)/city" />;
  return <Redirect href="/(tabs)" />;
}
