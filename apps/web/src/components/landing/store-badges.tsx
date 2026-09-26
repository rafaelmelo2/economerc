import type { IconType } from "react-icons";
import { FaApple, FaGooglePlay } from "react-icons/fa6";

interface StoreBadgeProps {
  icon: IconType;
  eyebrow: string;
  label: string;
}

// Links placeholder — trocar pelos links reais das lojas quando o app for publicado.
function StoreBadge({ icon: Icon, eyebrow, label }: StoreBadgeProps) {
  return (
    <a
      href="#"
      className="flex items-center gap-3 rounded-xl bg-foreground px-5 py-2.5 text-background transition hover:opacity-90"
    >
      <Icon className="size-6 shrink-0" />
      <span className="flex flex-col leading-tight text-left">
        <span className="text-[11px] opacity-80">{eyebrow}</span>
        <span className="font-display text-base font-semibold">{label}</span>
      </span>
    </a>
  );
}

export function StoreBadges({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      <StoreBadge icon={FaApple} eyebrow="Baixar na" label="App Store" />
      <StoreBadge icon={FaGooglePlay} eyebrow="Disponível no" label="Google Play" />
    </div>
  );
}
