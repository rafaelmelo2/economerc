import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";

import { CategoryIcon } from "@/components/icons/category-icon";
import { Text } from "@/components/ui/text";
import { CATEGORY_LABELS } from "@/lib/mock/categories";
import { useThemeColor } from "@/lib/theme/use-theme-color";
import type { CategoryKey } from "@/lib/types";

const CATEGORY_ORDER: readonly CategoryKey[] = [
  "hortifruti",
  "laticinios",
  "mercearia",
  "bebidas",
  "carnes",
  "padaria",
  "congelados",
  "limpeza",
  "higiene",
  "outros",
];

export interface CategoryPickerProps {
  value: CategoryKey;
  onChange: (category: CategoryKey) => void;
}

/** Seletor de categoria em chips — usado no cadastro rápido e sempre que o produto não traz categoria conhecida. */
export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const primaryColor = useThemeColor("primary");
  const mutedColor = useThemeColor("foreground-muted");

  return (
    <View className="gap-2">
      <Text variant="callout" color="muted">
        Categoria
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {CATEGORY_ORDER.map((category) => {
          const selected = category === value;
          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`Categoria ${CATEGORY_LABELS[category]}`}
              accessibilityState={{ selected }}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(category);
              }}
              className={`min-h-touch-min flex-row items-center gap-1.5 rounded-pill border px-3 py-2 ${
                selected ? "border-primary bg-primary-soft" : "border-border bg-surface"
              }`}
            >
              <CategoryIcon category={category} size={16} color={selected ? primaryColor : mutedColor} />
              <Text variant="footnote" color={selected ? "primary" : "muted"}>
                {CATEGORY_LABELS[category]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
