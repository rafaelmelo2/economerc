import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryBarChart } from "@/components/history/category-bar-chart";
import { MonthEvolutionChart } from "@/components/history/month-evolution-chart";
import { MonthSelector } from "@/components/history/month-selector";
import { PendingReceiptRow } from "@/components/history/pending-receipt-row";
import { PurchaseRow } from "@/components/history/purchase-row";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { getDb } from "@/lib/db/client";
import { listAllReceipts } from "@/lib/db/receipts-repository";
import type { ReceiptRow } from "@/lib/db/types";
import { formatCentsToBRL } from "@/lib/format/money";
import {
  aggregateCategorySpend,
  aggregateMonthlyEvolution,
  parseMonthKeyToDate,
  purchasesInMonth,
  shiftMonthKey,
  sumPurchasesTotalCents,
  toSaoPauloMonthKey,
} from "@/lib/history/aggregate";
import { loadHistoryData } from "@/lib/history/data";
import { seedDemoHistoryIfEmpty } from "@/lib/history/demo-seed";
import { CATEGORY_LABELS } from "@/lib/mock/categories";
import type { Purchase } from "@/lib/receipts/reconciliation";
import type { CategorySpend } from "@/lib/types";

const EVOLUTION_MONTHS_BACK = 6;
const NON_FINAL_RECEIPT_STATUSES = new Set<ReceiptRow["status"]>(["queued", "pending", "processing", "failed"]);

function currentMonthKey(): string {
  return toSaoPauloMonthKey(new Date().toISOString());
}

export default function HistoryScreen() {
  const params = useLocalSearchParams() as Record<string, string | undefined>;
  const isDemo = params.demo === "1"; // só semeia dado local pra screenshot (Playwright/CI)
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [purchases, setPurchases] = useState<readonly Purchase[]>([]);
  const [cartItemsForCategory, setCartItemsForCategory] = useState<
    readonly { cartClientId: string; category: CategorySpend["category"]; totalCents: number }[]
  >([]);
  const [pendingReceipts, setPendingReceipts] = useState<readonly ReceiptRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (isDemo) seedDemoHistoryIfEmpty();
      const data = loadHistoryData();
      setPurchases(data.purchases);
      setCartItemsForCategory(data.cartItemsForCategory);
      setPendingReceipts(listAllReceipts(getDb()).filter((row) => NON_FINAL_RECEIPT_STATUSES.has(row.status)));
    }, [isDemo]),
  );

  const monthPurchases = purchasesInMonth(purchases, monthKey);
  const monthTotalCents = sumPurchasesTotalCents(monthPurchases);
  const categorySpend: CategorySpend[] = aggregateCategorySpend(monthPurchases, cartItemsForCategory).map(
    (entry) => ({ category: entry.category, label: CATEGORY_LABELS[entry.category], totalCents: entry.totalCents }),
  );
  const evolutionPoints = aggregateMonthlyEvolution(purchases, parseMonthKeyToDate(monthKey), EVOLUTION_MONTHS_BACK);

  const hasAnyHistory = purchases.length > 0;
  const isCurrentOrPastMonth = monthKey <= currentMonthKey();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <FlashList<Purchase>
        data={monthPurchases}
        keyExtractor={(purchase) => purchase.id}
        ListHeaderComponent={
          <View className="gap-4 pb-4">
            <MonthSelector
              monthKey={monthKey}
              onPrevious={() => setMonthKey((current) => shiftMonthKey(current, -1))}
              onNext={() => setMonthKey((current) => shiftMonthKey(current, 1))}
              canGoNext={monthKey < currentMonthKey()}
            />

            <Card className="gap-1">
              <Text variant="callout" color="muted">
                Total do mês
              </Text>
              <Text variant="price-hero" className="tabular-nums">
                {formatCentsToBRL(monthTotalCents)}
              </Text>
              <Text variant="footnote" color="muted">
                {monthPurchases.length} {monthPurchases.length === 1 ? "compra" : "compras"}
              </Text>
            </Card>

            {pendingReceipts.length > 0 ? (
              <View className="gap-2">
                <Text variant="callout" color="muted">
                  Notas em andamento
                </Text>
                {pendingReceipts.map((row) => (
                  <PendingReceiptRow key={row.client_id} row={row} />
                ))}
              </View>
            ) : null}

            {categorySpend.length > 0 ? (
              <Card className="gap-3">
                <Text variant="callout" className="font-sans-semibold">
                  Gasto por categoria
                </Text>
                <CategoryBarChart data={categorySpend} />
              </Card>
            ) : null}

            {hasAnyHistory ? (
              <Card className="gap-3">
                <Text variant="callout" className="font-sans-semibold">
                  Evolução mensal
                </Text>
                <MonthEvolutionChart points={evolutionPoints} highlightMonthKey={monthKey} />
              </Card>
            ) : null}

            {monthPurchases.length > 0 ? (
              <Text variant="callout" color="muted" className="pt-1">
                Compras do mês
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <PurchaseRow purchase={item} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text variant="body" color="muted" className="px-4 pt-8 text-center">
            {!hasAnyHistory
              ? "Sua primeira compra aparece aqui. Escaneie ou leia a nota no fim da compra."
              : isCurrentOrPastMonth
                ? "Nenhuma compra nesse mês."
                : "Esse mês ainda não chegou."}
          </Text>
        }
      />
    </SafeAreaView>
  );
}
