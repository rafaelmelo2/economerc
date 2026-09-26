// Ponte entre packages/design-tokens/dist/native.ts (gerado) e o runtime do NativeWind.
// Nunca editar dist/native.ts à mão — mudar cor/fonte/raio é sempre em tokens.json + `bun run tokens`.
import { charts, font, radius, size, space, themes } from "@economerc/design-tokens/native";

export type ColorSchemeName = keyof typeof themes;
export const COLOR_TOKENS = themes;
export { charts, font, radius, size, space };

/** Nomes de variável CSS que o tailwind.config.js referencia via var(--x). */
export const THEME_VAR_KEYS = Object.keys(themes.light) as Array<keyof typeof themes.light>;

/** Monta o mapa { "--background": "#..." } para injetar via vars() no root da árvore. */
export function buildCssVars(scheme: ColorSchemeName): Record<string, string> {
  const theme = themes[scheme];
  const vars: Record<string, string> = {};
  for (const key of THEME_VAR_KEYS) {
    vars[`--${key}`] = theme[key];
  }
  return vars;
}
