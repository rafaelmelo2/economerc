import { router } from "expo-router";
import { Platform, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useSessionStore, type AuthProvider } from "@/lib/store/session-store";

export default function WelcomeScreen() {
  const signIn = useSessionStore((state) => state.signIn);

  // TODO onda 3: login real — trocar id_token do provedor no backend via JWKS (skill `auth`).
  function signInMock(provider: AuthProvider) {
    signIn(provider);
    router.replace("/(onboarding)/city");
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
          <Button variant="primary" size="lg" onPress={() => signInMock("google")}>
            Entrar com Google
          </Button>
          {Platform.OS === "ios" ? (
            <Button variant="outline" size="lg" onPress={() => signInMock("apple")}>
              Entrar com Apple
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
