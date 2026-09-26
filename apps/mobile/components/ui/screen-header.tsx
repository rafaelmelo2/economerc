import { ChevronLeft } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
}

/** Cabeçalho de tela fora das abas (Stack global roda com `headerShown: false`) — mesma
 * convenção de `components/onboarding/onboarding-progress.tsx`. */
export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  const iconColor = useThemeColor("foreground");

  return (
    <View className="min-h-touch-min flex-row items-center px-4 pt-2">
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        className="h-touch-min w-touch-min items-center justify-center"
      >
        <ChevronLeft size={24} color={iconColor} />
      </Pressable>
      <Text variant="title-3" className="flex-1 text-center" numberOfLines={1}>
        {title}
      </Text>
      <View className="h-touch-min w-touch-min" />
    </View>
  );
}
