import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { elevationStyle } from "@/lib/theme/elevation";

export interface CardProps extends ViewProps {
  children: ReactNode;
  className?: string;
}

/** Superfície base (cards, itens do carrinho). Raio `lg` e sombra suave conforme `visual.md`. */
export function Card({ children, className, style, ...props }: CardProps) {
  return (
    <View className={`rounded-lg bg-surface p-4 ${className ?? ""}`} style={[elevationStyle(1), style]} {...props}>
      {children}
    </View>
  );
}
