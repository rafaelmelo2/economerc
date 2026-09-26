import { FlashList } from "@shopify/flash-list";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryBarChart } from "@/components/history/category-bar-chart";
import { PurchaseRow } from "@/components/history/purchase-row";
import { SavingsCard } from "@/components/history/savings-card";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { formatMonthLabel } from "@/lib/format/date";
import { MOCK_CATEGORY_SPEND, MOCK_PURCHASES, MOCK_SAVINGS_CENTS } from "@/lib/mock/history";
import type { HistoryPurchase } from "@/lib/types";

export default function HistoryScreen() {
  const monthLabel = formatMonthLabel(new Date(2026, 8, 1));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <FlashList<HistoryPurchase>
        data={[...MOCK_PURCHASES]}
        keyExtractor={(purchase) => purchase.id}
        ListHeaderComponent={
          <View className="gap-4 pb-4">
            <Text variant="title-1">{monthLabel}</Text>
            <SavingsCard
              savingsCents={MOCK_SAVINGS_CENTS}
              purchaseCount={MOCK_PURCHASES.length}
              monthLabel={monthLabel.toLowerCase()}
            />
            <Card className="gap-3">
              <Text variant="callout" className="font-sans-semibold">
                Gasto por categoria
              </Text>
              <CategoryBarChart data={MOCK_CATEGORY_SPEND} />
            </Card>
            <Text variant="callout" color="muted" className="pt-1">
              Compras do mês
            </Text>
          </View>
        }
        renderItem={({ item }) => <PurchaseRow purchase={item} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text variant="body" color="muted" className="px-4 pt-8 text-center">
            Sua primeira compra aparece aqui. Escaneie ou leia a nota no fim da compra.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
