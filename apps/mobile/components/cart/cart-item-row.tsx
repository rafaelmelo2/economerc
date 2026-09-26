import { Trash2 } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { CategoryIcon } from "@/components/icons/category-icon";
import { OfferBadge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import type { CartItemRecord } from "@/lib/cart/contract";
import { formatCentsToBRL } from "@/lib/format/money";
import { formatQuantityLabel, unitDisplayLabel } from "@/lib/format/quantity";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export interface CartItemRowProps {
  item: CartItemRecord;
  onPress: (item: CartItemRecord) => void;
  onRemove: (item: CartItemRecord) => void;
}

export function CartItemRow({ item, onPress, onRemove }: CartItemRowProps) {
  const iconColor = useThemeColor("primary");
  const dangerColor = useThemeColor("danger");
  const unitPriceLabel = `${formatCentsToBRL(item.unitPriceCents)}/${unitDisplayLabel(item.unit)}`;

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`Editar ${item.productName}`}
      className="flex-row items-center gap-3 rounded-md bg-surface p-3"
    >
      <View className="h-9 w-9 items-center justify-center rounded-md bg-primary-soft">
        <CategoryIcon category={item.category} size={20} color={iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          {item.isOffer ? <OfferBadge /> : null}
          <Text variant="callout" className="flex-1 font-sans-semibold" numberOfLines={1}>
            {item.productName}
          </Text>
        </View>
        <Text variant="caption" color="muted">
          {formatQuantityLabel(item.quantityMilli, item.unit)} · {unitPriceLabel}
        </Text>
      </View>
      <Text variant="price">{formatCentsToBRL(item.totalCents)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remover ${item.productName} do carrinho`}
        hitSlop={8}
        onPress={(event) => {
          event.stopPropagation();
          onRemove(item);
        }}
        className="min-h-touch-min min-w-touch-min items-center justify-center"
      >
        <Trash2 size={18} color={dangerColor} accessibilityLabel="" />
      </Pressable>
    </Pressable>
  );
}
