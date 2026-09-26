import { router } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useSessionStore } from "@/lib/store/session-store";

export default function WelcomeScreen() {
  const signInWithGoogle = useSessionStore((state) => state.signInWithGoogle);
  const signInWithApple = useSessionStore((state) => state.signInWithApple);
  const signInDev = useSessionStore((state) => state.signInDev);
  const [busyProvider, setBusyProvider] = useState<"google" | "apple" | "dev" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn(provider: "google" | "apple" | "dev") {
    setErrorMessage(null);
    setBusyProvider(provider);
    try {
      if (provider === "google") await signInWithGoogle();
      else if (provider === "apple") await signInWithApple();
      else await signInDev();
      router.replace("/");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível entrar. Tente de novo.");
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 justify-between px-6 py-8">
        <View className="gap-3 pt-12">
          <View className="h-14 w-14 items-center justify-center rounded-lg bg-primary">
            <Text variant="title-1" color="on-primary">
              E
            </Text>
          </View>
          <Text variant="display" className="pt-4">
            Saiba quanto vai gastar antes do caixa.
          </Text>
          <Text variant="body" color="muted">
            Escaneie, some e economize no mercado. O total do carrinho fica sempre na tela,
            mesmo sem internet.
          </Text>
        </View>

        <View className="gap-3">
          {errorMessage ? (
            <Text variant="footnote" color="danger" className="text-center">
              {errorMessage}
            </Text>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            disabled={busyProvider !== null}
            onPress={() => void handleSignIn("google")}
          >
            {busyProvider === "google" ? "Entrando…" : "Entrar com Google"}
          </Button>
          {Platform.OS === "ios" ? (
            <Button
              variant="outline"
              size="lg"
              disabled={busyProvider !== null}
              onPress={() => void handleSignIn("apple")}
            >
              {busyProvider === "apple" ? "Entrando…" : "Entrar com Apple"}
            </Button>
          ) : null}
          {__DEV__ ? (
            <Button
              variant="ghost"
              size="lg"
              disabled={busyProvider !== null}
              onPress={() => void handleSignIn("dev")}
            >
              {busyProvider === "dev" ? "Entrando…" : "Entrar (dev)"}
            </Button>
          ) : null}
          <Text variant="caption" color="muted" className="pt-2 text-center">
            Sem senha, sem SMS. Só a sua conta Google ou Apple.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
