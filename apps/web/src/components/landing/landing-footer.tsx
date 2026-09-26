export function LandingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col items-center gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <img src="/simbolo.svg" alt="" className="size-5" />
          <span>© {new Date().getFullYear()} EconoMerc · Catalão-GO</span>
        </div>
        <nav className="flex items-center gap-5">
          <a href="#" className="hover:text-foreground">
            Privacidade
          </a>
          <a href="#" className="hover:text-foreground">
            Termos de uso
          </a>
        </nav>
      </div>
    </footer>
  );
}
