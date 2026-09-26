const { palette } = require("@economerc/design-tokens/tokens.json");

const themeVarColor = (name) => `var(--${name})`;

// Ramps cruas da paleta (ex.: `bg-grafite-950`) — para os poucos casos que não são semânticos
// por tema (ex.: fundo sempre-escuro do viewfinder da câmera). Fonte: tokens.json > palette.
const paletteColors = Object.fromEntries(
  Object.entries(palette).map(([ramp, steps]) => [ramp, steps]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ...paletteColors,
        background: themeVarColor("background"),
        surface: themeVarColor("surface"),
        "surface-muted": themeVarColor("surface-muted"),
        border: themeVarColor("border"),
        foreground: themeVarColor("foreground"),
        "foreground-muted": themeVarColor("foreground-muted"),
        primary: themeVarColor("primary"),
        "primary-foreground": themeVarColor("primary-foreground"),
        "primary-soft": themeVarColor("primary-soft"),
        accent: themeVarColor("accent"),
        "accent-foreground": themeVarColor("accent-foreground"),
        "accent-soft": themeVarColor("accent-soft"),
        danger: themeVarColor("danger"),
        "danger-foreground": themeVarColor("danger-foreground"),
        "danger-soft": themeVarColor("danger-soft"),
        warning: themeVarColor("warning"),
        "warning-soft": themeVarColor("warning-soft"),
        info: themeVarColor("info"),
        savings: themeVarColor("savings"),
        ring: themeVarColor("ring"),
        scrim: themeVarColor("scrim"),
      },
      fontFamily: {
        display: ["BricolageGrotesque_800ExtraBold"],
        "display-medium": ["BricolageGrotesque_500Medium"],
        "display-bold": ["BricolageGrotesque_700Bold"],
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
      },
      fontSize: {
        "price-hero": ["44px", { lineHeight: "48px", letterSpacing: "-1px" }],
        display: ["34px", { lineHeight: "40px", letterSpacing: "-0.5px" }],
        "title-1": ["28px", { lineHeight: "34px", letterSpacing: "-0.3px" }],
        "title-2": ["22px", { lineHeight: "28px" }],
        "title-3": ["18px", { lineHeight: "24px" }],
        body: ["16px", { lineHeight: "24px" }],
        callout: ["15px", { lineHeight: "22px" }],
        price: ["17px", { lineHeight: "22px" }],
        footnote: ["13px", { lineHeight: "18px" }],
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0.2px" }],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        pill: "999px",
      },
      spacing: {
        "touch-min": "44px",
        "icon-sm": "16px",
        "icon-md": "24px",
        "icon-lg": "32px",
        scan: "72px",
      },
    },
  },
  plugins: [],
};
