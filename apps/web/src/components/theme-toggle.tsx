import { LuMoon, LuSun } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/theme";

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={toggleTheme}
    >
      {isDark ? <LuSun className="size-4" /> : <LuMoon className="size-4" />}
    </Button>
  );
}
