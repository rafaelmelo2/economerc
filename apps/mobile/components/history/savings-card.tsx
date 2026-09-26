import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { formatCentsToBRL } from "@/lib/format/money";

export interface SavingsCardProps {
  savingsCents: number;
  purchaseCount: number;
  monthLabel: string;
}

/** Card "Você economizou" — cor primária cheia, conforme `vitrine.html`. */
export function SavingsCard({ savingsCents, purchaseCount, monthLabel }: SavingsCardProps) {
  return (
    <View className="gap-1 rounded-lg bg-primary p-4">
      <Text variant="callout" color="on-primary" className="opacity-90">
        Você economizou
      </Text>
      <Text variant="display" color="on-primary" className="tabular-nums">
        {formatCentsToBRL(savingsCents)}
      </Text>
      <Text variant="callout" color="on-primary" className="opacity-90">
        seguindo a lista, em {purchaseCount} compras de {monthLabel}
      </Text>
    </View>
  );
}
