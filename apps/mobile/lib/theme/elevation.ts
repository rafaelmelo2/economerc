import { Platform } from "react-native";

import { palette } from "@economerc/design-tokens/native";

// RN não interpreta `box-shadow` CSS (tokens.elevation) — aproxima os 3 níveis de
// `visual.md` (sombras suaves, esverdeadas, nunca preto puro) com shadow* (iOS/web) + elevation (Android).
const SHADOW_TINT = palette.grafite[900];

const LEVELS = {
  1: { opacity: 0.06, radius: 2, offsetY: 1, elevation: 1 },
  2: { opacity: 0.08, radius: 6, offsetY: 3, elevation: 3 },
  3: { opacity: 0.14, radius: 12, offsetY: 6, elevation: 6 },
} as const;

export type ElevationLevel = keyof typeof LEVELS;

export function elevationStyle(level: ElevationLevel) {
  const config = LEVELS[level];
  if (Platform.OS === "android") {
    return { elevation: config.elevation };
  }
  return {
    shadowColor: SHADOW_TINT,
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    shadowOffset: { width: 0, height: config.offsetY },
  };
}
