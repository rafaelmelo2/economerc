import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react-native";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { listCities } from "@/lib/api/cities";
import { useOnboardingDraftStore } from "@/lib/store/onboarding-draft-store";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export default function OnboardingCityScreen() {
  const cityId = useOnboardingDraftStore((state) => state.cityId);
  const setCity = useOnboardingDraftStore((state) => state.setCity);
  const primaryColor = useThemeColor("primary");

  const citiesQuery = useQuery({ queryKey: ["cities"], queryFn: listCities });

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

        {citiesQuery.isPending ? (
          <View className="items-center py-8">
            <ActivityIndicator color={primaryColor} />
          </View>
        ) : citiesQuery.isError ? (
          <View className="items-center gap-3 py-8">
            <Text variant="callout" color="danger" className="text-center">
              Não deu pra carregar as cidades. Confira sua conexão.
            </Text>
            <Button variant="outline" onPress={() => void citiesQuery.refetch()}>
              Tentar de novo
            </Button>
          </View>
        ) : (
          <View className="gap-2">
            {citiesQuery.data.map((city) => {
              const selected = city.id === cityId;
              return (
                <Pressable
                  key={city.id}
                  onPress={() => setCity(city.id, `${city.name} · ${city.stateCode}`)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={`min-h-touch-min flex-row items-center justify-between rounded-md border px-4 py-3 ${
                    selected ? "border-primary bg-primary-soft" : "border-border bg-surface"
                  }`}
                >
                  <Text variant="callout" className="font-sans-medium">
                    {city.name} · {city.stateCode}
                  </Text>
                  {selected ? (
                    <Check size={20} color={primaryColor} accessibilityLabel="Selecionado" />
                  ) : null}
                </Pressable>
              );
            })}
            {citiesQuery.data.length === 0 ? (
              <Text variant="callout" color="danger">
                Nenhuma cidade cadastrada ainda.
              </Text>
            ) : null}
          </View>
        )}

        <View className="flex-1" />

        <Button
          size="lg"
          className="mb-4"
          disabled={cityId === null}
          onPress={() => router.push("/(onboarding)/family")}
        >
          Continuar
        </Button>
      </View>
    </SafeAreaView>
  );
}
