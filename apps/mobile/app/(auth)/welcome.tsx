import { router } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useSessionStore } from "@/lib/store/session-store";

/**
 * Símbolo da marca (`docs/brand/logo/simbolo.svg`) — etiqueta de gôndola com o furo em amarelo.
 * Cores fixas por regra de marca (`docs/brand/visual.md` → Logo: "nunca trocar o amarelo do
 * furo"), não tokens de tema — o logomark não se adapta a claro/escuro.
 */
function BrandSymbol({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="EconoMerc">
      <Path
        d="M40 10h38a8 8 0 0 1 8 8v60a8 8 0 0 1-8 8H40a8 8 0 0 1-5.66-2.34L12.34 61.66a8 8 0 0 1 0-11.32L34.34 12.34A8 8 0 0 1 40 10Z"
        transform="rotate(-8 48 48)"
        fill="#0E6B47"
      />
      <Circle cx={31} cy={54} r={6.5} fill="#FFC83D" />
      <Path
        d="M46 36l10 12 8-7 12 17"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M68 58h8v-8" fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

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
          <View className="h-14 w-14 items-center justify-center" accessibilityLabel="EconoMerc">
            <BrandSymbol size={56} />
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
