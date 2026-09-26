import { Link } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/theme";

export function LandingHeader() {
  const isDark = useThemeStore((s) => s.theme === "dark");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-4 sm:px-6">
        <img
          src={isDark ? "/logo-horizontal-escuro.svg" : "/logo-horizontal.svg"}
          alt="EconoMerc"
          className="h-7 sm:h-8"
        />
        <div className="flex items-center gap-1.5 sm:gap-3">
          <ThemeToggle />
          <Button asChild size="sm" className="sm:h-10 sm:px-5">
            <Link to="/entrar">Entrar</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
