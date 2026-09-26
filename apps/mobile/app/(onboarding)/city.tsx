import { Check } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { CITY_OPTIONS } from "@/lib/mock/cities";
import { useOnboardingDraftStore } from "@/lib/store/onboarding-draft-store";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export default function OnboardingCityScreen() {
  const citySlug = useOnboardingDraftStore((state) => state.citySlug);
  const setCity = useOnboardingDraftStore((state) => state.setCity);
  const primaryColor = useThemeColor("primary");

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-6 px-6 pt-4">
        <OnboardingProgress step={1} />

        <View className="gap-1">
          <Text variant="title-1">Onde você compra?</Text>
          <Text variant="body" color="muted">
            Usamos sua cidade pra mostrar preços e ofertas da sua região.
          </Text>
        </View>

        <View className="gap-2">
          {CITY_OPTIONS.map((city) => {
            const selected = city.slug === citySlug;
            return (
              <Pressable
                key={city.slug}
                onPress={() => setCity(city.slug)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className={`min-h-touch-min flex-row items-center justify-between rounded-md border px-4 py-3 ${
                  selected ? "border-primary bg-primary-soft" : "border-border bg-surface"
                }`}
              >
                <Text variant="callout" className="font-sans-medium">
                  {city.name} · {city.state}
                </Text>
                {selected ? <Check size={20} color={primaryColor} accessibilityLabel="Selecionado" /> : null}
              </Pressable>
            );
          })}
        </View>

        <View className="flex-1" />

        <Button size="lg" className="mb-4" onPress={() => router.push("/(onboarding)/family")}>
          Continuar
        </Button>
      </View>
    </SafeAreaView>
  );
}
