import { ScanLine } from "lucide-react-native";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/lib/theme/use-theme-color";

/** Estado vazio do carrinho — texto exato de `docs/brand/voz.md`. */
export function EmptyCart() {
  const iconColor = useThemeColor("primary");

  return (
    <View className="flex-1 items-center justify-center gap-4 px-8 py-16">
      <View className="h-16 w-16 items-center justify-center rounded-pill bg-primary-soft">
        <ScanLine size={28} color={iconColor} accessibilityLabel="" />
      </View>
      <Text variant="title-3" className="text-center">
        Carrinho vazio
      </Text>
      <Text variant="body" color="muted" className="text-center">
        Aponte a câmera pro código de barras do primeiro produto.
      </Text>
    </View>
  );
}
