import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  cartItemToRowData,
  PurchaseItemRow,
  receiptItemToRowData,
} from "@/components/receipts/purchase-item-row";
import { ReconciliationCard } from "@/components/receipts/reconciliation-card";
import { Card } from "@/components/ui/card";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Text } from "@/components/ui/text";
import { formatDayMonth } from "@/lib/format/date";
import { formatCentsToBRL } from "@/lib/format/money";
import { getPurchaseDetail, type PurchaseDetail } from "@/lib/history/data";

export default function PurchaseDetailScreen() {
  const { purchaseId } = useLocalSearchParams<{ purchaseId: string }>();
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);

  useFocusEffect(
    useCallback(() => {
      setDetail(purchaseId ? getPurchaseDetail(purchaseId) : null);
    }, [purchaseId]),
  );

  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <ScreenHeader title="Compra" onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  const { purchase, cartItems, receipt, comparison } = detail;
  const preferReceiptItems = (receipt?.items.length ?? 0) > 0;
  const rows = preferReceiptItems
    ? (receipt?.items.map(receiptItemToRowData) ?? [])
    : cartItems.map(cartItemToRowData);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title={purchase.marketName ?? "Compra"} onBack={() => router.back()} />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <PurchaseItemRow item={item} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListHeaderComponent={
          <View className="gap-4 pb-4">
            <Card className="gap-1">
              <Text variant="callout" color="muted">
                {purchase.marketName ?? "Mercado não informado"} · {formatDayMonth(new Date(purchase.date))}
              </Text>
              <Text variant="display" className="tabular-nums">
                {formatCentsToBRL(purchase.totalCents)}
              </Text>
              <Text variant="footnote" color="muted">
                {purchase.itemCount} {purchase.itemCount === 1 ? "item" : "itens"}
                {purchase.source === "matched" ? " · carrinho + nota" : purchase.source === "receipt" ? " · nota fiscal" : ""}
              </Text>
            </Card>

            {comparison && receipt ? (
              <ReconciliationCard
                cartTotalCents={cartItems.reduce((sum, item) => sum + item.totalCents, 0)}
                receiptTotalCents={receipt.totalAmountCents ?? purchase.totalCents}
                onlyInCart={comparison.onlyInCart}
                onlyInReceipt={comparison.onlyInReceipt}
              />
            ) : null}

            {rows.length > 0 ? (
              <Text variant="callout" color="muted">
                Itens
              </Text>
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
