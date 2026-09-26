import { useId, useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

/** Campo de texto base — ≥16px sempre (evita o zoom automático do iOS). */
export function Input({ label, error, className, style, onFocus, onBlur, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputId = useId();
  const placeholderColor = useThemeColor("foreground-muted");

  return (
    <View className="gap-1.5">
      {label ? (
        <Text variant="callout" color="muted" nativeID={inputId}>
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabelledBy={label ? inputId : undefined}
        placeholderTextColor={placeholderColor}
        className={`min-h-touch-min rounded-md border bg-surface px-4 text-body text-foreground ${
          error ? "border-danger" : isFocused ? "border-primary" : "border-border"
        } ${className ?? ""}`}
        style={[{ fontSize: 16 }, style]}
        onFocus={(event) => {
          setIsFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        {...props}
      />
      {error ? (
        <Text variant="footnote" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
