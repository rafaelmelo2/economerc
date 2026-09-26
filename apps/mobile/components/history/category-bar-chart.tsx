import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { formatCentsToBRL } from "@/lib/format/money";
import { useThemeColor } from "@/lib/theme/use-theme-color";
import type { CategorySpend } from "@/lib/types";

const BAR_HEIGHT = 14;
const CHART_WIDTH = 160;

export interface CategoryBarChartProps {
  data: readonly CategorySpend[];
}

/** Gasto por categoria: barras horizontais em uma cor só (`primary`), ver `visual.md` → Gráficos. */
export function CategoryBarChart({ data }: CategoryBarChartProps) {
  const barColor = useThemeColor("primary");
  const trackColor = useThemeColor("surface-muted");
  const maxCents = Math.max(...data.map((entry) => entry.totalCents), 1);

  return (
    <View
      className="gap-3"
      accessibilityRole="none"
      accessibilityLabel={`Gasto por categoria: ${data.map((entry) => `${entry.label} ${formatCentsToBRL(entry.totalCents)}`).join(", ")}`}
    >
      {data.map((entry) => {
        const widthRatio = entry.totalCents / maxCents;
        return (
          <View key={entry.category} className="flex-row items-center gap-2">
            <Text variant="caption" color="muted" className="w-20" numberOfLines={1}>
              {entry.label}
            </Text>
            <Svg width={CHART_WIDTH} height={BAR_HEIGHT} accessibilityElementsHidden>
              <Rect width={CHART_WIDTH} height={BAR_HEIGHT} rx={4} fill={trackColor} />
              <Rect width={Math.max(CHART_WIDTH * widthRatio, 4)} height={BAR_HEIGHT} rx={4} fill={barColor} />
            </Svg>
            <Text variant="caption" className="flex-1 text-right font-sans-semibold tabular-nums">
              {formatCentsToBRL(entry.totalCents)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
