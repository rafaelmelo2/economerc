import { AlertTriangle, CircleAlert, CircleCheck } from "lucide-react-native";
import { View } from "react-native";

import { Progress, type ProgressTone } from "@/components/ui/progress";
import { Text, type TextColor } from "@/components/ui/text";
import { formatCentsToBRL } from "@/lib/format/money";
import { useThemeColor } from "@/lib/theme/use-theme-color";
import type { BudgetStatus } from "@/lib/types";

const TONE_BY_STATE: Record<BudgetStatus["state"], ProgressTone> = {
  ok: "primary",
  warning: "warning",
  over: "danger",
};

const TEXT_COLOR_BY_STATE: Record<BudgetStatus["state"], TextColor> = {
  ok: "muted",
  warning: "warning",
  over: "danger",
};

const THEME_KEY_BY_STATE = {
  ok: "primary",
  warning: "warning",
  over: "danger",
} as const;

// Microcopy conforme `docs/brand/voz.md` — número primeiro, sem culpa.
function buildStatusMessage(status: BudgetStatus): string {
  if (status.state === "over") {
    return `Passou ${formatCentsToBRL(Math.abs(status.remainingCents))} do orçamento. Quer ver o que dá pra trocar?`;
  }
  if (status.state === "warning") {
    return `Faltam ${formatCentsToBRL(status.remainingCents)} pro seu orçamento. Vale revisar o carrinho?`;
  }
  return `${status.percentage}% do orçamento · faltam ${formatCentsToBRL(status.remainingCents)}`;
}

export interface BudgetBarProps {
  status: BudgetStatus;
}

export function BudgetBar({ status }: BudgetBarProps) {
  const iconColor = useThemeColor(THEME_KEY_BY_STATE[status.state]);
  const StatusIcon = status.state === "over" ? CircleAlert : status.state === "warning" ? AlertTriangle : CircleCheck;

  return (
    <View className="gap-2">
      <Text variant="price-hero">{formatCentsToBRL(status.spentCents)}</Text>
      <Progress percentage={status.percentage} tone={TONE_BY_STATE[status.state]} />
      <View className="flex-row items-center gap-1.5">
        <StatusIcon size={16} color={iconColor} accessibilityLabel="" />
        <Text variant="footnote" color={TEXT_COLOR_BY_STATE[status.state]} className="tabular-nums">
          {buildStatusMessage(status)}
        </Text>
      </View>
    </View>
  );
}
