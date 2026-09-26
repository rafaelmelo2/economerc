import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { Text } from "@/components/ui/text";
import { formatCentsAsBRLInput, parseBRLInputToCents } from "@/lib/format/money";
import { useOnboardingDraftStore } from "@/lib/store/onboarding-draft-store";
import { useSessionStore } from "@/lib/store/session-store";

const MIN_BUDGET_CENTS = 5000;

export default function OnboardingBudgetScreen() {
  const monthlyBudgetCents = useOnboardingDraftStore((state) => state.monthlyBudgetCents);
  const setMonthlyBudgetCents = useOnboardingDraftStore((state) => state.setMonthlyBudgetCents);
  const cityId = useOnboardingDraftStore((state) => state.cityId);
  const cityLabel = useOnboardingDraftStore((state) => state.cityLabel);
  const familySize = useOnboardingDraftStore((state) => state.familySize);
  const resetDraft = useOnboardingDraftStore((state) => state.reset);
  const completeOnboarding = useSessionStore((state) => state.completeOnboarding);
  const [isSaving, setIsSaving] = useState(false);

  const [rawInput, setRawInput] = useState(formatCentsAsBRLInput(monthlyBudgetCents));
  const isValid = monthlyBudgetCents >= MIN_BUDGET_CENTS;

  function handleChangeText(text: string) {
    const cents = parseBRLInputToCents(text);
    setMonthlyBudgetCents(cents);
    setRawInput(formatCentsAsBRLInput(cents));
  }

  async function finish() {
    setIsSaving(true);
    try {
      await completeOnboarding({ cityId, cityLabel, familySize, monthlyBudgetCents });
      resetDraft();
      router.replace("/(tabs)");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-6 px-6 pt-4">
        <OnboardingProgress step={3} onBack={() => router.back()} />

        <View className="gap-1">
          <Text variant="title-1">Qual seu orçamento mensal?</Text>
          <Text variant="body" color="muted">
            Avisamos quando o carrinho chegar perto do limite. Dá pra mudar depois em Perfil.
          </Text>
        </View>

        <Input
          label="Orçamento mensal"
          value={rawInput}
          onChangeText={handleChangeText}
          keyboardType="numeric"
          inputMode="numeric"
          returnKeyType="done"
          className="text-title-2"
        />

        <View className="flex-1" />

        <Button
          size="lg"
          className="mb-4"
          disabled={!isValid || isSaving}
          loading={isSaving}
          onPress={() => void finish()}
        >
          Começar a usar o EconoMerc
        </Button>
      </View>
    </SafeAreaView>
  );
}
