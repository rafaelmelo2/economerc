import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { Text, type TextColor } from "@/components/ui/text";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "default" | "sm" | "lg";

const CONTAINER_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary active:opacity-90",
  secondary: "bg-surface-muted active:opacity-90",
  outline: "bg-transparent border border-border active:bg-surface-muted",
  ghost: "bg-transparent active:bg-surface-muted",
  destructive: "bg-danger active:opacity-90",
};

const TEXT_COLOR_BY_VARIANT: Record<ButtonVariant, Extract<TextColor, "on-primary" | "foreground">> = {
  primary: "on-primary",
  secondary: "foreground",
  outline: "foreground",
  ghost: "foreground",
  destructive: "on-primary",
};

const SPINNER_THEME_KEY_BY_TEXT_COLOR = {
  "on-primary": "primary-foreground",
  foreground: "foreground",
} as const;

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: "min-h-touch-min px-5 py-3",
  sm: "min-h-touch-min px-4 py-2",
  lg: "min-h-[52px] px-6 py-4",
};

export interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
  className?: string;
  /** Desliga o haptic de toque (ex.: em listas onde já há outro feedback). */
  withHaptics?: boolean;
}

/** Botão base do design system. Alvo de toque sempre ≥44pt (grade `touch-min`). */
export function Button({
  variant = "primary",
  size = "default",
  loading = false,
  disabled,
  onPress,
  children,
  className,
  withHaptics = true,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const textColor = TEXT_COLOR_BY_VARIANT[variant];
  const spinnerColor = useThemeColor(SPINNER_THEME_KEY_BY_TEXT_COLOR[textColor]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={(event) => {
        if (withHaptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      className={`flex-row items-center justify-center gap-2 rounded-md ${CONTAINER_VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${isDisabled ? "opacity-50" : ""} ${className ?? ""}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : typeof children === "string" ? (
        <Text variant="callout" color={textColor} className="font-sans-semibold">
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
