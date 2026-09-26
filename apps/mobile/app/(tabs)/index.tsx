import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CartItemEditSheet } from "@/components/cart/cart-item-edit-sheet";
import { BudgetBar } from "@/components/cart/budget-bar";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { EmptyCart } from "@/components/cart/empty-cart";
import { MarketPickerSheet } from "@/components/cart/market-picker-sheet";
import { ScanToast } from "@/components/scan/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Text } from "@/components/ui/text";
import {
  addCartItem,
  closeActiveCart,
  setCartBudget,
  setCartMarket,
  removeCartItem,
  useActiveCart,
  type CartItemRecord,
} from "@/lib/cart/contract";
import { computeBudgetStatus } from "@/lib/budget";
import { formatCentsToBRL } from "@/lib/format/money";
import { useSessionStore } from "@/lib/store/session-store";

/** Quando não há orçamento definido pra esta compra, chuta 1/4 do mensal (visão semanal). */
const FALLBACK_BUDGET_DIVISOR = 4;
const BUDGET_ALERT_THRESHOLD_PERCENTAGE = 80;
const BUDGET_OVER_PERCENTAGE = 100;

export default function CartScreen() {
  const monthlyBudgetCents = useSessionStore((state) => state.onboarding.monthlyBudgetCents);
  const cityId = useSessionStore((state) => state.onboarding.cityId);
  const cart = useActiveCart();

  const [editingItem, setEditingItem] = useState<CartItemRecord | null>(null);
  const [undoToast, setUndoToast] = useState<{ item: CartItemRecord } | null>(null);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [readReceiptPromptOpen, setReadReceiptPromptOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [marketPickerVisible, setMarketPickerVisible] = useState(false);
  const lastClosedCartClientIdRef = useRef<string | null>(null);

  const previousPercentageRef = useRef(0);
  const previousItemCountRef = useRef(cart.items.length);

  useEffect(() => {
    if (cart.budgetCents === null) {
      void setCartBudget(Math.round(monthlyBudgetCents / FALLBACK_BUDGET_DIVISOR));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só inicializa 1x quando o carrinho nasce sem orçamento
  }, [cart.budgetCents]);

  const budgetCents = cart.budgetCents ?? Math.round(monthlyBudgetCents / FALLBACK_BUDGET_DIVISOR);
  const status = computeBudgetStatus(cart.totalCents, budgetCents);

  useEffect(() => {
    const previous = previousPercentageRef.current;
    if (previous < BUDGET_OVER_PERCENTAGE && status.percentage >= BUDGET_OVER_PERCENTAGE) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (
      previous < BUDGET_ALERT_THRESHOLD_PERCENTAGE &&
      status.percentage >= BUDGET_ALERT_THRESHOLD_PERCENTAGE
    ) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    previousPercentageRef.current = status.percentage;
  }, [status.percentage]);

  useEffect(() => {
    if (cart.items.length > previousItemCountRef.current) {
      AccessibilityInfo.announceForAccessibility(`Total do carrinho: ${formatCentsToBRL(cart.totalCents)}`);
    }
    previousItemCountRef.current = cart.items.length;
  }, [cart.items.length, cart.totalCents]);

  function handleRemove(item: CartItemRecord) {
    void removeCartItem(item.clientId);
    setEditingItem((current) => (current?.clientId === item.clientId ? null : current));
    setUndoToast({ item });
  }

  async function handleUndoRemove(item: CartItemRecord) {
    await addCartItem({
      ean: item.ean,
      productName: item.productName,
      category: item.category,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      quantityMilli: item.quantityMilli,
      isOffer: item.isOffer,
      productId: item.productId,
    });
  }

  /** `closeActiveCart` já move a compra pro histórico local (status='closed') e agenda o sync —
   * a única coisa que falta aqui é oferecer o próximo passo (ler a nota). */
  async function handleConfirmFinish() {
    setFinishing(true);
    lastClosedCartClientIdRef.current = cart.clientId;
    await closeActiveCart();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFinishing(false);
    setFinishDialogOpen(false);
    setReadReceiptPromptOpen(true);
  }

  function handleSelectMarket(market: { id: string; tradeName: string }) {
    void setCartMarket(market.id, market.tradeName);
    setMarketPickerVisible(false);
  }

  function handleSelectOtherMarket(freeTextName: string) {
    void setCartMarket(null, freeTextName);
    setMarketPickerVisible(false);
  }

  function handleReadReceiptNow() {
    setReadReceiptPromptOpen(false);
    router.push({
      pathname: "/(tabs)/scan",
      params: { intent: "receipt", cartClientId: lastClosedCartClientIdRef.current ?? "" },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 gap-4 px-4 pt-2">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => setMarketPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={
              cart.marketName
                ? `Compra em andamento no ${cart.marketName}. Tocar para trocar de mercado.`
                : "Tocar para escolher em qual mercado você está"
            }
            className="min-h-touch-min flex-1 flex-row items-center py-1"
          >
            <Text variant="footnote" color="muted">
              Compra em andamento · {cart.marketName ?? "toque para escolher o mercado"}
            </Text>
          </Pressable>
          <Text variant="caption" color="muted" accessibilityLabel="Carrinho salvo no aparelho, sincroniza quando tiver internet">
            Salvo no aparelho
          </Text>
        </View>

        <Card>
          <BudgetBar status={status} />
        </Card>

        {cart.items.length === 0 ? (
          <EmptyCart />
        ) : (
          <FlashList<CartItemRecord>
            data={cart.items}
            keyExtractor={(item) => item.clientId}
            renderItem={({ item }) => (
              <CartItemRow item={item} onPress={setEditingItem} onRemove={handleRemove} />
            )}
            ItemSeparatorComponent={() => <View className="h-2" />}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {cart.items.length > 0 ? (
        <View className="border-t border-border bg-background px-4 pb-3 pt-3">
          <Button size="lg" onPress={() => setFinishDialogOpen(true)}>
            Finalizar compra
          </Button>
        </View>
      ) : null}

      <CartItemEditSheet item={editingItem} onClose={() => setEditingItem(null)} onRemove={handleRemove} />

      <MarketPickerSheet
        visible={marketPickerVisible}
        cityId={cityId}
        currentMarketId={cart.marketId}
        onClose={() => setMarketPickerVisible(false)}
        onSelectMarket={handleSelectMarket}
        onSelectOther={handleSelectOtherMarket}
      />

      {undoToast ? (
        <ScanToast
          message="Item removido"
          actionLabel="Desfazer"
          onAction={() => void handleUndoRemove(undoToast.item)}
          onDismiss={() => setUndoToast(null)}
        />
      ) : null}

      <ConfirmDialog
        visible={finishDialogOpen}
        title="Finalizar compra?"
        description={`O carrinho fecha com ${formatCentsToBRL(cart.totalCents)} e vai pro seu histórico. Você ainda pode ler a nota da compra em seguida.`}
        confirmLabel="Finalizar"
        onConfirm={() => void handleConfirmFinish()}
        onCancel={() => setFinishDialogOpen(false)}
      />
      {finishing ? null : (
        <ConfirmDialog
          visible={readReceiptPromptOpen}
          title="Compra finalizada"
          description="Quer ler a nota fiscal agora? A gente lê o QR Code e confere os itens e o total pago."
          confirmLabel="Ler a nota agora"
          cancelLabel="Agora não"
          onConfirm={handleReadReceiptNow}
          onCancel={() => setReadReceiptPromptOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}
