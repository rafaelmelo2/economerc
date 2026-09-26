import { router } from "expo-router";
import { FileCheck2, Store } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { formatDayMonth } from "@/lib/format/date";
import { formatCentsToBRL } from "@/lib/format/money";
import type { Purchase } from "@/lib/receipts/reconciliation";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export function PurchaseRow({ purchase }: { purchase: Purchase }) {
  const iconColor = useThemeColor("foreground-muted");
  const Icon = purchase.source === "receipt" ? FileCheck2 : Store;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/history/[purchaseId]", params: { purchaseId: purchase.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalhe da compra em ${purchase.marketName ?? "mercado não informado"}`}
      className="flex-row items-center gap-3 rounded-md bg-surface p-3"
    >
      <View className="h-9 w-9 items-center justify-center rounded-md bg-surface-muted">
        <Icon size={18} color={iconColor} accessibilityLabel="" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="callout" className="font-sans-semibold" numberOfLines={1}>
          {purchase.marketName ?? "Mercado não informado"}
        </Text>
        <Text variant="caption" color="muted">
          {formatDayMonth(new Date(purchase.date))} · {purchase.itemCount} itens
        </Text>
      </View>
      <Text variant="price">{formatCentsToBRL(purchase.totalCents)}</Text>
    </Pressable>
  );
}
