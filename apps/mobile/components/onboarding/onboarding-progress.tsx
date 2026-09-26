import { ChevronLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/lib/theme/use-theme-color";

const TOTAL_STEPS = 3;

export interface OnboardingProgressProps {
  step: 1 | 2 | 3;
  onBack?: () => void;
}

export function OnboardingProgress({ step, onBack }: OnboardingProgressProps) {
  const iconColor = useThemeColor("foreground");

  return (
    <View className="gap-3 pb-2">
      <View className="min-h-touch-min flex-row items-center">
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            className="h-touch-min w-touch-min items-center justify-center"
          >
            <ChevronLeft size={24} color={iconColor} />
          </Pressable>
        ) : (
          <View className="h-touch-min w-touch-min" />
        )}
        <Text variant="footnote" color="muted" className="flex-1 text-center">
          Passo {step} de {TOTAL_STEPS}
        </Text>
        <View className="h-touch-min w-touch-min" />
      </View>
      <Progress percentage={(step / TOTAL_STEPS) * 100} />
    </View>
  );
}
