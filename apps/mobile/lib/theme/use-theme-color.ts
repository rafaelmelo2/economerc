import { useColorScheme } from "nativewind";

import { COLOR_TOKENS } from "@/lib/theme/tokens";

/**
 * Cor resolvida (hex) para usos que não aceitam className — ícones Lucide (SVG),
 * `react-native-svg`, `trackColor` de Switch. Reativa ao tema claro/escuro.
 */
export function useThemeColor(key: keyof typeof COLOR_TOKENS.light): string {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";
  return COLOR_TOKENS[scheme][key];
}
