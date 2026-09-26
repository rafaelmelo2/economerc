import { View } from "react-native";

import { Text } from "@/components/ui/text";
import type { ReceiptItemCache } from "@/lib/db/types";
import { formatCentsToBRL } from "@/lib/format/money";
import { formatQuantityLabel, formatReceiptQuantityLabel, unitDisplayLabel } from "@/lib/format/quantity";
import type { PurchaseDetailCartItem } from "@/lib/history/data";

export interface PurchaseItemRowData {
  key: string;
  name: string;
  quantityLabel: string;
  unitPriceCents: number;
  unitLabel: string | null;
  totalCents: number;
}

export function cartItemToRowData(item: PurchaseDetailCartItem): PurchaseItemRowData {
  return {
    key: item.clientId,
    name: item.productName,
    quantityLabel: formatQuantityLabel(item.quantityMilli, item.unit as Parameters<typeof unitDisplayLabel>[0]),
    unitPriceCents: item.unitPriceCents,
    unitLabel: unitDisplayLabel(item.unit as Parameters<typeof unitDisplayLabel>[0]),
    totalCents: item.totalCents,
  };
}

export function receiptItemToRowData(item: ReceiptItemCache): PurchaseItemRowData {
  return {
    key: item.id,
    name: item.rawName,
    quantityLabel: formatReceiptQuantityLabel(item.quantity, item.unit),
    unitPriceCents: item.unitPriceCents,
    unitLabel: item.unit ? item.unit.toLowerCase() : null,
    totalCents: item.totalPriceCents,
  };
}

/** Uma linha de item no detalhe da compra — serve tanto pra item de carrinho quanto de nota
 * (o call site já converteu pro mesmo shape; ver `lib/history/data.ts`). Preço por unidade
 * sempre visível (item 4 do escopo: "preço por unidade no detalhe"). */
export function PurchaseItemRow({ item }: { item: PurchaseItemRowData }) {
  return (
    <View className="flex-row items-center gap-3 rounded-md bg-surface p-3">
      <View className="flex-1 gap-0.5">
        <Text variant="callout" className="font-sans-semibold" numberOfLines={2}>
          {item.name}
        </Text>
        <Text variant="caption" color="muted">
          {item.quantityLabel}
          {item.unitLabel ? ` · ${formatCentsToBRL(item.unitPriceCents)}/${item.unitLabel}` : ""}
        </Text>
      </View>
      <Text variant="price">{formatCentsToBRL(item.totalCents)}</Text>
    </View>
  );
}
