import { Tag } from "lucide-react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/lib/theme/use-theme-color";

/** Mural de ofertas — Fase 2 (`docs/produto.md`). Aqui só o placeholder "em breve". */
export default function OffersScreen() {
  const iconColor = useThemeColor("accent-foreground");

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <View className="h-16 w-16 items-center justify-center rounded-pill bg-accent-soft">
          <Tag size={28} color={iconColor} accessibilityLabel="" />
        </View>
        <Text variant="title-3" className="text-center">
          Ofertas da região, em breve
        </Text>
        <Text variant="body" color="muted" className="text-center">
          Ainda não temos ofertas na sua região. Viu um preço bom? Conta pra gente assim que essa
          novidade chegar.
        </Text>
      </View>
    </SafeAreaView>
  );
}
