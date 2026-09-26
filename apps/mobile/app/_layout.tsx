import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { queryClient } from "@/lib/api/query-client";
import { useSessionStore } from "@/lib/store/session-store";
import { initSyncEngine } from "@/lib/sync/engine";
import { ThemeRoot } from "@/lib/theme/theme-root";

import "@/global.css";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const isBootstrapping = useSessionStore((state) => state.isBootstrapping);
  const bootstrap = useSessionStore((state) => state.bootstrap);

  // Bootstrap da sessão (refresh do token guardado no SecureStore) e o motor
  // de sync (NetInfo/AppState) sobem uma vez só, antes de qualquer tela.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => initSyncEngine(), []);

  useEffect(() => {
    if (fontsLoaded && !isBootstrapping) void SplashScreen.hideAsync();
  }, [fontsLoaded, isBootstrapping]);

  if (!fontsLoaded || isBootstrapping) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <ThemeRoot>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeRoot>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
