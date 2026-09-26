import { Redirect, Stack } from "expo-router";

import { useSessionStore } from "@/lib/store/session-store";

export default function AuthLayout() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);

  if (isAuthenticated) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
