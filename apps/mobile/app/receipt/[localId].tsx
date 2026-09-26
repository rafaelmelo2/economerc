import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PurchaseItemRow, receiptItemToRowData } from "@/components/receipts/purchase-item-row";
import { ReconciliationCard } from "@/components/receipts/reconciliation-card";
import { ReceiptStatusView } from "@/components/receipts/receipt-status-view";
import { Card } from "@/components/ui/card";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Text } from "@/components/ui/text";
import { findClosedCartByClientId } from "@/lib/cart/history-repository";
import { getDb } from "@/lib/db/client";
import { findReceiptByClientId } from "@/lib/db/receipts-repository";
import type { ReceiptItemCache, ReceiptRow } from "@/lib/db/types";
import { formatDayMonth } from "@/lib/format/date";
import { formatCentsToBRL } from "@/lib/format/money";
import { compareCartAndReceiptItems } from "@/lib/receipts/reconciliation";
import { refetchReceipt } from "@/lib/receipts/queue";

// Poll educado: só enquanto a nota pode mudar de status, parado assim que a tela sai de foco.
const POLL_INTERVAL_MS = 4000;

export default function ReceiptTrackingScreen() {
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const [row, setRow] = useState<ReceiptRow | null>(null);

  const load = useCallback(() => {
    if (!localId) return;
    setRow(findReceiptByClientId(getDb(), localId));
  }, [localId]);

  useFocusEffect(
    useCallback(() => {
      load();
      void refetchReceipt(localId ?? "").then(load);
    }, [load, localId]),
  );

  // Poll enquanto o status ainda pode mudar — para sozinho quando a tela perde foco (cleanup do
  // effect) ou quando a nota chega num estado terminal.
  useEffect(() => {
    if (!row) return;
    const isTransient = row.status === "queued" || row.status === "pending" || row.status === "processing";
    if (!isTransient) return;

    const intervalId = setInterval(() => {
      void refetchReceipt(row.client_id).then(load);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [row, load]);

  if (!row) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <ScreenHeader title="Nota fiscal" onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  const items = (() => {
    try {
      return JSON.parse(row.items_json) as ReceiptItemCache[];
    } catch {
      return [];
    }
  })();

  const isDone = row.status === "done" || row.status === "duplicate";
  const linkedCart = row.cart_client_id ? findClosedCartByClientId(row.cart_client_id) : null;
  const comparison =
    isDone && linkedCart
      ? compareCartAndReceiptItems(
          linkedCart.items.map((item) => ({ ean: item.ean, productName: item.productName })),
          items.map((item) => ({ ean: item.ean, rawName: item.rawName })),
        )
      : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <ScreenHeader title="Nota fiscal" onBack={() => router.back()} />
      <FlatList
        data={isDone ? items : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PurchaseItemRow item={receiptItemToRowData(item)} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListHeaderComponent={
          <View className="gap-4 pb-4">
            {isDone ? (
              <Card className="gap-1">
                <Text variant="callout" color="muted">
                  {row.market_name ?? "Mercado não identificado"}
                  {row.issued_at ? ` · ${formatDayMonth(new Date(row.issued_at))}` : ""}
                </Text>
                <Text variant="display" className="tabular-nums">
                  {formatCentsToBRL(row.total_amount_cents ?? 0)}
                </Text>
                <Text variant="footnote" color="muted">
                  {items.length} {items.length === 1 ? "item" : "itens"}
                </Text>
              </Card>
            ) : (
              <ReceiptStatusView status={row.status} failureReason={row.failure_reason} />
            )}

            {row.status === "duplicate" ? (
              <ReceiptStatusView status="duplicate" failureReason={null} />
            ) : null}

            {comparison && linkedCart ? (
              <ReconciliationCard
                cartTotalCents={linkedCart.totalCents}
                receiptTotalCents={row.total_amount_cents ?? 0}
                onlyInCart={comparison.onlyInCart}
                onlyInReceipt={comparison.onlyInReceipt}
              />
            ) : null}

            {isDone && items.length > 0 ? (
              <Text variant="callout" color="muted">
                Itens da nota
              </Text>
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
