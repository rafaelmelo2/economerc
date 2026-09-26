import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { formatMonthYearLabel } from "@/lib/format/date";
import { parseMonthKeyToDate } from "@/lib/history/aggregate";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export interface MonthSelectorProps {
  monthKey: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext: boolean;
}

/** Seletor de mês do histórico (item 4 do escopo) — nunca deixa ir pro futuro. */
export function MonthSelector({ monthKey, onPrevious, onNext, canGoNext }: MonthSelectorProps) {
  const iconColor = useThemeColor("foreground");
  const disabledColor = useThemeColor("foreground-muted");

  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        onPress={onPrevious}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Mês anterior"
        className="h-touch-min w-touch-min items-center justify-center"
      >
        <ChevronLeft size={22} color={iconColor} />
      </Pressable>
      <Text variant="title-2">{formatMonthYearLabel(parseMonthKeyToDate(monthKey))}</Text>
      <Pressable
        onPress={onNext}
        disabled={!canGoNext}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Próximo mês"
        className="h-touch-min w-touch-min items-center justify-center"
      >
        <ChevronRight size={22} color={canGoNext ? iconColor : disabledColor} />
      </Pressable>
    </View>
  );
}
