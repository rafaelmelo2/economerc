import type { IconType } from "react-icons";

interface EmptyStateProps {
  icon: IconType;
  title: string;
  description: string;
}

/** Estado vazio no tom do EconoMerc (ver docs/brand/voz.md) — usado nas páginas placeholder. */
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" />
      </div>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
