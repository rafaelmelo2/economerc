import { View } from "react-native";

import { Text } from "@/components/ui/text";

/** Selo OFERTA — amarelo é sinal, não decoração (ver `visual.md`): só onde é oferta de verdade. */
export function OfferBadge() {
  return (
    <View className="self-start rounded-sm bg-accent px-1.5 py-0.5" accessibilityLabel="Oferta">
      <Text variant="caption" color="on-accent" className="font-sans-semibold tracking-wide">
        OFERTA
      </Text>
    </View>
  );
}
