import { View } from "react-native";

import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { formatCentsToBRL } from "@/lib/format/money";

export interface ReconciliationCardProps {
  cartTotalCents: number;
  receiptTotalCents: number;
  onlyInCart: readonly string[];
  onlyInReceipt: readonly string[];
}

/** Conciliação simples carrinho × nota (item 3 do escopo) — só exibição, nunca altera dado. */
export function ReconciliationCard({
  cartTotalCents,
  receiptTotalCents,
  onlyInCart,
  onlyInReceipt,
}: ReconciliationCardProps) {
  const differenceCents = receiptTotalCents - cartTotalCents;
  const hasDifference = Math.abs(differenceCents) >= 1;

  return (
    <Card className="gap-3">
      <Text variant="callout" className="font-sans-semibold">
        Carrinho × nota
      </Text>

      <View className="flex-row gap-3">
        <View className="flex-1 gap-1 rounded-md bg-surface-muted p-3">
          <Text variant="caption" color="muted">
            Carrinho escaneado
          </Text>
          <Text variant="price" className="tabular-nums">
            {formatCentsToBRL(cartTotalCents)}
          </Text>
        </View>
        <View className="flex-1 gap-1 rounded-md bg-primary-soft p-3">
          <Text variant="caption" color="muted">
            Pago na nota
          </Text>
          <Text variant="price" className="tabular-nums">
            {formatCentsToBRL(receiptTotalCents)}
          </Text>
        </View>
      </View>

      {hasDifference ? (
        <Text variant="footnote" color={differenceCents > 0 ? "warning" : "primary"}>
          {differenceCents > 0
            ? `A nota veio ${formatCentsToBRL(differenceCents)} mais alta — pode ser item digitado com preço diferente.`
            : `A nota veio ${formatCentsToBRL(Math.abs(differenceCents))} mais baixa que o carrinho.`}
        </Text>
      ) : null}

      {onlyInCart.length > 0 ? (
        <View className="gap-1">
          <Text variant="footnote" color="muted">
            Só no carrinho (a nota não trouxe)
          </Text>
          {onlyInCart.map((name) => (
            <Text key={name} variant="callout">
              · {name}
            </Text>
          ))}
        </View>
      ) : null}

      {onlyInReceipt.length > 0 ? (
        <View className="gap-1">
          <Text variant="footnote" color="muted">
            Só na nota (você não escaneou)
          </Text>
          {onlyInReceipt.map((name) => (
            <Text key={name} variant="callout">
              · {name}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
