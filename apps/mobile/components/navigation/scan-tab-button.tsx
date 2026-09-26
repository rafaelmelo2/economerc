import * as Haptics from "expo-haptics";
import { ScanLine } from "lucide-react-native";
import type { GestureResponderEvent } from "react-native";
import { Pressable, View } from "react-native";

import { elevationStyle } from "@/lib/theme/elevation";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export interface ScanTabButtonProps {
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
}

/** Botão central de scan — 72pt, redondo, verde, elevado (ver `visual.md` → Forma). */
export function ScanTabButton({ onPress, accessibilityState }: ScanTabButtonProps) {
  const iconColor = useThemeColor("primary-foreground");

  return (
    <View className="flex-1 items-center justify-center">
      <Pressable
        onPress={(event) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress?.(event);
        }}
        accessibilityRole="button"
        accessibilityLabel="Escanear produto"
        accessibilityState={accessibilityState}
        style={elevationStyle(2)}
        className="-mt-8 h-scan w-scan items-center justify-center rounded-pill bg-primary"
      >
        <ScanLine size={30} color={iconColor} strokeWidth={2.25} />
      </Pressable>
    </View>
  );
}
