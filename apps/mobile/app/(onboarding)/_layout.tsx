import { Redirect, Stack } from "expo-router";

import { useSessionStore } from "@/lib/store/session-store";

export default function OnboardingLayout() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const onboardingComplete = useSessionStore((state) => state.onboardingComplete);

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  if (onboardingComplete) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
