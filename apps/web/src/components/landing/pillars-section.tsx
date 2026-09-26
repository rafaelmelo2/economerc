import type { IconType } from "react-icons";
import { LuScanLine, LuSparkles, LuUsers } from "react-icons/lu";

interface Pillar {
  icon: IconType;
  title: string;
  description: string;
}

// Os três pilares do produto — ver docs/brand/plataforma.md.
const PILLARS: readonly Pillar[] = [
  {
    icon: LuScanLine,
    title: "Controle",
    description: "Escaneou, somou. Você sabe quanto vai pagar antes de chegar no caixa.",
  },
  {
    icon: LuUsers,
    title: "Comunidade",
    description: "Quem viu o preço conta pra quem vai comprar — ofertas da região num lugar só.",
  },
  {
    icon: LuSparkles,
    title: "Inteligência",
    description: "No futuro, o app monta a compra mais barata por você, cruzando os mercados.",
  },
];

export function PillarsSection() {
  return (
    <section className="border-t bg-surface-muted/60">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto mb-10 max-w-xl text-center sm:mb-14">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            O jeito de comprar mercado sem perder o controle
          </h2>
          <p className="mt-3 text-muted-foreground">
            Três pilares, um app só. A Fase 1 entrega o primeiro; os outros dois vêm a seguir.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-[var(--shadow-1)]"
            >
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="font-display text-lg font-bold">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
