import { Minus, Plus } from "lucide-react-native";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { Text } from "@/components/ui/text";
import { useOnboardingDraftStore } from "@/lib/store/onboarding-draft-store";
import { useThemeColor } from "@/lib/theme/use-theme-color";

const MIN_FAMILY_SIZE = 1;
const MAX_FAMILY_SIZE = 8;

export default function OnboardingFamilyScreen() {
  const familySize = useOnboardingDraftStore((state) => state.familySize);
  const setFamilySize = useOnboardingDraftStore((state) => state.setFamilySize);
  const iconColor = useThemeColor("foreground");

  function updateBy(delta: number) {
    const next = Math.min(MAX_FAMILY_SIZE, Math.max(MIN_FAMILY_SIZE, familySize + delta));
    setFamilySize(next);
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-6 px-6 pt-4">
        <OnboardingProgress step={2} onBack={() => router.back()} />

        <View className="gap-1">
          <Text variant="title-1">Quantas pessoas moram com você?</Text>
          <Text variant="body" color="muted">
            Ajuda a sugerir um orçamento mensal no próximo passo.
          </Text>
        </View>

        <View className="flex-1 items-center justify-center gap-6">
          <View className="flex-row items-center gap-8">
            <Pressable
              onPress={() => updateBy(-1)}
              disabled={familySize <= MIN_FAMILY_SIZE}
              accessibilityRole="button"
              accessibilityLabel="Diminuir"
              className="h-touch-min w-touch-min items-center justify-center rounded-pill bg-surface-muted disabled:opacity-40"
            >
              <Minus size={22} color={iconColor} />
            </Pressable>
            <Text variant="display" className="tabular-nums">
              {familySize}
            </Text>
            <Pressable
              onPress={() => updateBy(1)}
              disabled={familySize >= MAX_FAMILY_SIZE}
              accessibilityRole="button"
              accessibilityLabel="Aumentar"
              className="h-touch-min w-touch-min items-center justify-center rounded-pill bg-surface-muted disabled:opacity-40"
            >
              <Plus size={22} color={iconColor} />
            </Pressable>
          </View>
          <Text variant="callout" color="muted">
            {familySize === 1 ? "Só eu" : `${familySize} pessoas`}
          </Text>
        </View>

        <Button size="lg" className="mb-4" onPress={() => router.push("/(onboarding)/budget")}>
          Continuar
        </Button>
      </View>
    </SafeAreaView>
  );
}
