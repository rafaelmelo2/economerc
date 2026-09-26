import * as Haptics from "expo-haptics";
import { Pressable, View } from "react-native";

import type { ProductUnit } from "@/lib/cart/contract";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { unitDisplayLabel } from "@/lib/format/quantity";

const SELECTABLE_UNITS: readonly ProductUnit[] = ["un", "kg"];

export interface QuantityFieldProps {
  unit: ProductUnit;
  onChangeUnit?: (unit: ProductUnit) => void;
  quantityText: string;
  onChangeQuantityText: (text: string) => void;
}

/**
 * Quantidade (un ou peso em kg) — teclado numérico, campo ≥16px (`Input` já garante isso).
 * `onChangeUnit` ausente = unidade travada (produto já conhecido pelo lookup traz o `unit` certo).
 */
export function QuantityField({ unit, onChangeUnit, quantityText, onChangeQuantityText }: QuantityFieldProps) {
  return (
    <View className="gap-1.5">
      <Text variant="callout" color="muted">
        Quantidade
      </Text>
      <View className="flex-row gap-2">
        <Input
          value={quantityText}
          onChangeText={onChangeQuantityText}
          keyboardType="decimal-pad"
          inputMode="decimal"
          className="flex-1"
          accessibilityLabel={`Quantidade em ${unitDisplayLabel(unit)}`}
        />
        {onChangeUnit ? (
          <View className="flex-row overflow-hidden rounded-md border border-border">
            {SELECTABLE_UNITS.map((option) => {
              const selected = option === unit;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityLabel={`Unidade ${unitDisplayLabel(option)}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onChangeUnit(option);
                  }}
                  className={`min-h-touch-min min-w-touch-min items-center justify-center px-4 ${
                    selected ? "bg-primary" : "bg-surface"
                  }`}
                >
                  <Text variant="callout" color={selected ? "on-primary" : "muted"} className="font-sans-semibold">
                    {unitDisplayLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View className="min-h-touch-min items-center justify-center rounded-md bg-surface-muted px-4">
            <Text variant="callout" color="muted">
              {unitDisplayLabel(unit)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
