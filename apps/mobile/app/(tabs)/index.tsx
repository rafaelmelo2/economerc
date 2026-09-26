import { FlashList } from "@shopify/flash-list";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BudgetBar } from "@/components/cart/budget-bar";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { EmptyCart } from "@/components/cart/empty-cart";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { computeBudgetStatus } from "@/lib/budget";
import { sumCents } from "@/lib/format/money";
import { MOCK_CART_ITEMS, MOCK_MARKET_NAME } from "@/lib/mock/cart";
import { useSessionStore } from "@/lib/store/session-store";
import type { CartItem } from "@/lib/types";

export default function CartScreen() {
  const monthlyBudgetCents = useSessionStore((state) => state.onboarding.monthlyBudgetCents);
  const items = MOCK_CART_ITEMS;
  const spentCents = sumCents(items.map((item) => item.totalCents));
  // Orçamento restante do mês contra o gasto desta compra — a soma do mês real chega com o histórico (onda 5).
  const status = computeBudgetStatus(spentCents, Math.round(monthlyBudgetCents / 4));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 gap-4 px-4 pt-2">
        <Text variant="footnote" color="muted">
          Compra em andamento · {MOCK_MARKET_NAME}
        </Text>

        <Card>
          <BudgetBar status={status} />
        </Card>

        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <FlashList<CartItem>
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <CartItemRow item={item} />}
            ItemSeparatorComponent={() => <View className="h-2" />}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
