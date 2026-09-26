// GERADO por packages/design-tokens/build.ts — não editar à mão.

export const themes = {
  "light": {
    "background": "#F7F6F1",
    "surface": "#FFFFFF",
    "surface-muted": "#EEEDE6",
    "border": "#DEDDD4",
    "foreground": "#10231A",
    "foreground-muted": "#5B6159",
    "primary": "#0E6B47",
    "primary-foreground": "#FFFFFF",
    "primary-soft": "#EAF6EF",
    "accent": "#FFC83D",
    "accent-foreground": "#10231A",
    "accent-soft": "#FFF3CC",
    "danger": "#C7372F",
    "danger-foreground": "#FFFFFF",
    "danger-soft": "#FDECEA",
    "warning": "#8A5A00",
    "warning-soft": "#FFF3CC",
    "info": "#2F6FDB",
    "savings": "#0E6B47",
    "ring": "#0E6B47",
    "scrim": "rgba(4, 28, 19, 0.5)"
  },
  "dark": {
    "background": "#0F1511",
    "surface": "#172019",
    "surface-muted": "#1F2A22",
    "border": "#2C382F",
    "foreground": "#E9EEE9",
    "foreground-muted": "#9AA59C",
    "primary": "#3DBB82",
    "primary-foreground": "#0A2E1F",
    "primary-soft": "#13301F",
    "accent": "#FFC83D",
    "accent-foreground": "#10231A",
    "accent-soft": "#3A2F0E",
    "danger": "#F07A6E",
    "danger-foreground": "#0F1511",
    "danger-soft": "#3A1A17",
    "warning": "#FFC83D",
    "warning-soft": "#3A2F0E",
    "info": "#7FA6F0",
    "savings": "#3DBB82",
    "ring": "#3DBB82",
    "scrim": "rgba(0, 0, 0, 0.6)"
  }
} as const;

export type ThemeName = keyof typeof themes;
export type ThemeColor = keyof typeof themes.light;

export const palette = {
  "verde": {
    "50": "#EAF6EF",
    "100": "#CDEBDA",
    "200": "#9FD6B8",
    "300": "#66BB90",
    "400": "#3DBB82",
    "500": "#148356",
    "600": "#0E6B47",
    "700": "#0B573A",
    "800": "#09442E",
    "900": "#0A2E1F",
    "950": "#041C13"
  },
  "etiqueta": {
    "50": "#FFF8E1",
    "100": "#FFF3CC",
    "200": "#FFE07A",
    "300": "#FFD34F",
    "400": "#FFC83D",
    "500": "#F2AE12",
    "600": "#CC8A00",
    "700": "#9E6800",
    "800": "#8A5A00",
    "900": "#4D3200"
  },
  "grafite": {
    "0": "#FFFFFF",
    "25": "#FBFAF6",
    "50": "#F7F6F1",
    "100": "#EEEDE6",
    "200": "#DEDDD4",
    "300": "#C4C3B8",
    "400": "#9A9A8E",
    "500": "#72746A",
    "600": "#5B6159",
    "700": "#3D413A",
    "800": "#1F2A22",
    "850": "#172019",
    "900": "#10231A",
    "950": "#0F1511"
  },
  "coral": {
    "50": "#FDECEA",
    "400": "#F07A6E",
    "600": "#C7372F",
    "900": "#3A1A17"
  },
  "azul": {
    "400": "#7FA6F0",
    "600": "#2F6FDB"
  }
} as const;

export const charts = {
  "categorical": {
    "light": [
      "#1E8A5A",
      "#2F6FDB",
      "#E29A00",
      "#6A4FC2",
      "#E0604F",
      "#169BA8"
    ],
    "dark": [
      "#249660",
      "#4C7FE0",
      "#B87D0A",
      "#8C73E6",
      "#DB604F",
      "#1E9CA8"
    ]
  },
  "other": {
    "light": "#9A9A8E",
    "dark": "#72746A"
  }
} as const;

export const font = {
  "family": {
    "display": "Bricolage Grotesque",
    "sans": "Inter"
  },
  "weight": {
    "regular": 400,
    "medium": 500,
    "semibold": 600,
    "bold": 700,
    "extrabold": 800
  },
  "scale": {
    "$note": "Mobile-first, em pt/px. `price-*` sempre com algarismos tabulares (tabular-nums).",
    "price-hero": {
      "size": 44,
      "line": 48,
      "family": "display",
      "weight": 800,
      "tracking": -1
    },
    "display": {
      "size": 34,
      "line": 40,
      "family": "display",
      "weight": 800,
      "tracking": -0.5
    },
    "title-1": {
      "size": 28,
      "line": 34,
      "family": "display",
      "weight": 700,
      "tracking": -0.3
    },
    "title-2": {
      "size": 22,
      "line": 28,
      "family": "display",
      "weight": 700,
      "tracking": 0
    },
    "title-3": {
      "size": 18,
      "line": 24,
      "family": "sans",
      "weight": 600,
      "tracking": 0
    },
    "body": {
      "size": 16,
      "line": 24,
      "family": "sans",
      "weight": 400,
      "tracking": 0
    },
    "callout": {
      "size": 15,
      "line": 22,
      "family": "sans",
      "weight": 500,
      "tracking": 0
    },
    "footnote": {
      "size": 13,
      "line": 18,
      "family": "sans",
      "weight": 400,
      "tracking": 0
    },
    "caption": {
      "size": 12,
      "line": 16,
      "family": "sans",
      "weight": 500,
      "tracking": 0.2
    },
    "price": {
      "size": 17,
      "line": 22,
      "family": "sans",
      "weight": 600,
      "tracking": 0
    }
  }
} as const;

export const space = {
  "0": 0,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "8": 32,
  "10": 40,
  "12": 48,
  "16": 64
} as const;
export const radius = {
  "sm": 8,
  "md": 12,
  "lg": 16,
  "xl": 24,
  "pill": 999
} as const;
export const size = {
  "touch-min": 44,
  "icon-sm": 16,
  "icon-md": 24,
  "icon-lg": 32,
  "scan-button": 72
} as const;
export const motion = {
  "duration": {
    "fast": 150,
    "base": 220,
    "slow": 320
  },
  "easing": {
    "enter": "cubic-bezier(0.2, 0.8, 0.2, 1)",
    "exit": "cubic-bezier(0.4, 0, 1, 1)",
    "standard": "cubic-bezier(0.2, 0, 0, 1)"
  },
  "spring": {
    "damping": 18,
    "stiffness": 220,
    "mass": 1
  }
} as const;
