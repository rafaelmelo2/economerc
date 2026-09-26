import { Store } from "lucide-react-native";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { formatDayMonth } from "@/lib/format/date";
import { formatCentsToBRL } from "@/lib/format/money";
import { useThemeColor } from "@/lib/theme/use-theme-color";
import type { HistoryPurchase } from "@/lib/types";

export function PurchaseRow({ purchase }: { purchase: HistoryPurchase }) {
  const iconColor = useThemeColor("foreground-muted");

  return (
    <View className="flex-row items-center gap-3 rounded-md bg-surface p-3">
      <View className="h-9 w-9 items-center justify-center rounded-md bg-surface-muted">
        <Store size={18} color={iconColor} accessibilityLabel="" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="callout" className="font-sans-semibold">
          {purchase.marketName}
        </Text>
        <Text variant="caption" color="muted">
          {formatDayMonth(purchase.date)} · {purchase.itemCount} itens
        </Text>
      </View>
      <Text variant="price">{formatCentsToBRL(purchase.totalCents)}</Text>
    </View>
  );
}
