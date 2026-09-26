import { create } from "zustand";

/**
 * Tema claro/escuro. Os tokens (`packages/design-tokens/dist/web.css`) já respondem a
 * `prefers-color-scheme` sozinhos; este store só existe para o botão de alternância manual
 * guardar a preferência e escrever `data-theme` no `<html>` (mesmo mecanismo de `vitrine.html`).
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "economerc-theme";

function readSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : null;
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const initialTheme = readStoredTheme() ?? readSystemTheme();
applyTheme(initialTheme);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    get().setTheme(get().theme === "dark" ? "light" : "dark");
  },
}));
