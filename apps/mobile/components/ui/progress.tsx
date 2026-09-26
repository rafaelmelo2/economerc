import { View } from "react-native";

export type ProgressTone = "primary" | "warning" | "danger";

const TONE_CLASSES: Record<ProgressTone, string> = {
  primary: "bg-primary",
  warning: "bg-warning",
  danger: "bg-danger",
};

export interface ProgressProps {
  /** 0–100. Valores acima de 100 saturam a barra (visual de "estourou"). */
  percentage: number;
  tone?: ProgressTone;
  className?: string;
}

/** Barra de progresso genérica (orçamento, passos do onboarding). */
export function Progress({ percentage, tone = "primary", className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <View
      className={`h-2.5 overflow-hidden rounded-pill bg-surface-muted ${className ?? ""}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
    >
      <View className={`h-full rounded-pill ${TONE_CLASSES[tone]}`} style={{ width: `${clamped}%` }} />
    </View>
  );
}
