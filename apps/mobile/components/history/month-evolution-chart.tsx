import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { parseMonthKeyToDate, type MonthEvolutionPoint } from "@/lib/history/aggregate";
import { formatCentsToBRL } from "@/lib/format/money";
import { useThemeColor } from "@/lib/theme/use-theme-color";

const BAR_WIDTH = 28;
const BAR_GAP = 12;
const CHART_HEIGHT = 96;
const CURRENT_MONTH_OPACITY = 1;
const OTHER_MONTHS_OPACITY = 0.4; // docs/brand/visual.md > Gráficos > Evolução mensal

const MONTH_ABBREVIATION_FORMATTER = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function shortMonthLabel(monthKey: string): string {
  return MONTH_ABBREVIATION_FORMATTER.format(parseMonthKeyToDate(monthKey)).replace(".", "");
}

export interface MonthEvolutionChartProps {
  points: readonly MonthEvolutionPoint[];
  highlightMonthKey: string;
}

/** Evolução dos últimos meses (item 4 do escopo) — barras verticais em `primary`, o mês em
 * destaque cheio e os demais a 40% de opacidade (`visual.md` > Gráficos). */
export function MonthEvolutionChart({ points, highlightMonthKey }: MonthEvolutionChartProps) {
  const barColor = useThemeColor("primary");
  const maxCents = Math.max(...points.map((point) => point.totalCents), 1);
  const chartWidth = points.length * BAR_WIDTH + Math.max(points.length - 1, 0) * BAR_GAP;

  return (
    <View
      className="gap-2"
      accessibilityRole="none"
      accessibilityLabel={`Evolução mensal: ${points
        .map((point) => `${shortMonthLabel(point.monthKey)} ${formatCentsToBRL(point.totalCents)}`)
        .join(", ")}`}
    >
      <Svg width={chartWidth} height={CHART_HEIGHT} accessibilityElementsHidden>
        {points.map((point, index) => {
          const barHeight = Math.max((point.totalCents / maxCents) * CHART_HEIGHT, 4);
          const x = index * (BAR_WIDTH + BAR_GAP);
          const isHighlighted = point.monthKey === highlightMonthKey;
          return (
            <Rect
              key={point.monthKey}
              x={x}
              y={CHART_HEIGHT - barHeight}
              width={BAR_WIDTH}
              height={barHeight}
              rx={6}
              fill={barColor}
              opacity={isHighlighted ? CURRENT_MONTH_OPACITY : OTHER_MONTHS_OPACITY}
            />
          );
        })}
      </Svg>
      <View className="flex-row" style={{ width: chartWidth, gap: BAR_GAP }}>
        {points.map((point) => (
          <Text key={point.monthKey} variant="caption" color="muted" style={{ width: BAR_WIDTH }} className="text-center">
            {shortMonthLabel(point.monthKey)}
          </Text>
        ))}
      </View>
    </View>
  );
}
