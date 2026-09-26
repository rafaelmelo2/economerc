import { View } from "react-native";

import { Text } from "@/components/ui/text";

/**
 * Placeholder da câmera — a leitura real (expo-camera + EAN-13/UPC-A/QR) chega na onda 3B
 * (`.claude/rules/mobile.md` → Scan). Aqui só a moldura visual da tela.
 */
export function CameraPlaceholder() {
  return (
    <View className="flex-1 items-center justify-center rounded-xl bg-grafite-950">
      <View className="h-32 w-52 rounded-lg border-2 border-primary" />
      <Text variant="callout" className="mt-6 text-center text-grafite-0">
        Aponte para o código de barras
      </Text>
    </View>
  );
}
