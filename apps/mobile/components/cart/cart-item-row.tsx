import { View } from "react-native";

import { OfferBadge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { CategoryIcon } from "@/components/icons/category-icon";
import { formatCentsToBRL, formatUnitPriceToBRL } from "@/lib/format/money";
import { useThemeColor } from "@/lib/theme/use-theme-color";
import type { CartItem } from "@/lib/types";

export interface CartItemRowProps {
  item: CartItem;
}

export function CartItemRow({ item }: CartItemRowProps) {
  const iconColor = useThemeColor("primary");

  return (
    <View className="flex-row items-center gap-3 rounded-md bg-surface p-3">
      <View className="h-9 w-9 items-center justify-center rounded-md bg-primary-soft">
        <CategoryIcon category={item.category} size={20} color={iconColor} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          {item.isOffer ? <OfferBadge /> : null}
          <Text variant="callout" className="flex-1 font-sans-semibold" numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Text variant="caption" color="muted">
          {item.quantityLabel} · {formatUnitPriceToBRL(item.unitPriceCents, item.unitLabel)}
        </Text>
      </View>
      <Text variant="price">{formatCentsToBRL(item.totalCents)}</Text>
    </View>
  );
}
