import { Text as RNText, type TextProps as RNTextProps } from "react-native";

export type TextVariant =
  | "price-hero"
  | "display"
  | "title-1"
  | "title-2"
  | "title-3"
  | "body"
  | "callout"
  | "price"
  | "footnote"
  | "caption";

export type TextColor =
  | "foreground"
  | "muted"
  | "primary"
  | "danger"
  | "warning"
  | "on-primary"
  | "on-accent";

const VARIANT_CLASSES: Record<TextVariant, string> = {
  "price-hero": "font-display text-price-hero tabular-nums",
  display: "font-display text-display",
  "title-1": "font-display-bold text-title-1",
  "title-2": "font-display-bold text-title-2",
  "title-3": "font-sans-semibold text-title-3",
  body: "font-sans text-body",
  callout: "font-sans-medium text-callout",
  price: "font-sans-semibold text-price tabular-nums",
  footnote: "font-sans text-footnote",
  caption: "font-sans-medium text-caption",
};

const COLOR_CLASSES: Record<TextColor, string> = {
  foreground: "text-foreground",
  muted: "text-foreground-muted",
  primary: "text-primary",
  danger: "text-danger",
  warning: "text-warning",
  "on-primary": "text-primary-foreground",
  "on-accent": "text-accent-foreground",
};

export interface AppTextProps extends RNTextProps {
  variant?: TextVariant;
  color?: TextColor;
  className?: string;
}

/** Texto base do design system — tipografia e cor sempre via token, nunca hex/px solto. */
export function Text({ variant = "body", color = "foreground", className, style, ...props }: AppTextProps) {
  const tabular = variant === "price-hero" || variant === "price";
  return (
    <RNText
      className={`${VARIANT_CLASSES[variant]} ${COLOR_CLASSES[color]} ${className ?? ""}`}
      style={[tabular ? { fontVariant: ["tabular-nums"] } : null, style]}
      {...props}
    />
  );
}
