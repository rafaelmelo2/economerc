// Gera os artefatos de tema a partir de tokens.json.
//   dist/web.css   → CSS vars (claro/escuro) + bloco @theme do Tailwind 4 (apps/web)
//   dist/native.ts → objetos tipados para o app Expo (NativeWind / StyleSheet)
// Uso: bun run build

import tokens from "./tokens.json";

type Palette = Record<string, Record<string, string>>;
type Theme = Record<string, string>;

const palette = tokens.palette as Palette;

function resolve(value: string): string {
  const match = /^\{(\w+)\.(\w+)\}$/.exec(value);
  if (!match) return value;
  const [, ramp, step] = match;
  const hex = palette[ramp]?.[step];
  if (!hex) throw new Error(`Token inexistente: ${value}`);
  return hex;
}

function resolveTheme(theme: Theme): Theme {
  return Object.fromEntries(Object.entries(theme).map(([k, v]) => [k, resolve(v)]));
}

const light = resolveTheme(tokens.themes.light);
const dark = resolveTheme(tokens.themes.dark);

function varsBlock(theme: Theme, charts: string[], other: string, indent = "  "): string {
  const lines = Object.entries(theme).map(([k, v]) => `${indent}--${k}: ${v};`);
  charts.forEach((c, i) => lines.push(`${indent}--chart-${i + 1}: ${c};`));
  lines.push(`${indent}--chart-other: ${other};`);
  return lines.join("\n");
}

const { scale } = tokens.font;
const family = tokens.font.family;

const webCss = `/* GERADO por packages/design-tokens/build.ts — não editar à mão. */

:root {
  color-scheme: light;
${varsBlock(light, tokens.charts.categorical.light, tokens.charts.other.light)}
}

@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
${varsBlock(dark, tokens.charts.categorical.dark, tokens.charts.other.dark, "    ")}
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
${varsBlock(dark, tokens.charts.categorical.dark, tokens.charts.other.dark)}
}

@theme inline {
${Object.keys(light)
  .filter((k) => k !== "scrim")
  .map((k) => `  --color-${k}: var(--${k});`)
  .join("\n")}
${Object.entries(palette)
  .flatMap(([ramp, steps]) => Object.entries(steps).map(([s, hex]) => `  --color-${ramp}-${s}: ${hex};`))
  .join("\n")}
  --font-display: "${family.display}", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "${family.sans}", ui-sans-serif, system-ui, sans-serif;
${Object.entries(tokens.radius)
  .map(([k, v]) => `  --radius-${k}: ${v}px;`)
  .join("\n")}
${Object.entries(tokens.elevation)
  .map(([k, v]) => `  --shadow-${k}: ${v};`)
  .join("\n")}
${Object.entries(scale)
  .filter(([k]) => !k.startsWith("$"))
  .map(([k, v]) => {
    const s = v as { size: number; line: number };
    return `  --text-${k}: ${s.size / 16}rem;\n  --text-${k}--line-height: ${+(s.line / s.size).toFixed(4)};`;
  })
  .join("\n")}
  --ease-enter: ${tokens.motion.easing.enter};
  --ease-exit: ${tokens.motion.easing.exit};
  --ease-standard: ${tokens.motion.easing.standard};
}
`;

const nativeTs = `// GERADO por packages/design-tokens/build.ts — não editar à mão.

export const themes = ${JSON.stringify({ light, dark }, null, 2)} as const;

export type ThemeName = keyof typeof themes;
export type ThemeColor = keyof typeof themes.light;

export const palette = ${JSON.stringify(palette, null, 2)} as const;

export const charts = ${JSON.stringify(
  { categorical: tokens.charts.categorical, other: tokens.charts.other },
  null,
  2,
)} as const;

export const font = ${JSON.stringify(tokens.font, null, 2)} as const;

export const space = ${JSON.stringify(tokens.space, null, 2)} as const;
export const radius = ${JSON.stringify(tokens.radius, null, 2)} as const;
export const size = ${JSON.stringify(tokens.size, null, 2)} as const;
export const motion = ${JSON.stringify(tokens.motion, null, 2)} as const;
`;

await Bun.write(new URL("./dist/web.css", import.meta.url), webCss);
await Bun.write(new URL("./dist/native.ts", import.meta.url), nativeTs);
console.log("design-tokens: dist/web.css e dist/native.ts gerados");
