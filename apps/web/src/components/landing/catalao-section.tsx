import { LuMapPin } from "react-icons/lu";

export function CatalaoSection() {
  return (
    <section className="border-t">
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="order-2 flex justify-center lg:order-1">
          <MapPinBadge />
        </div>

        <div className="order-1 flex flex-col gap-4 text-center lg:order-2 lg:text-left">
          <span className="mx-auto inline-flex w-fit items-center gap-1.5 rounded-pill bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent-foreground uppercase lg:mx-0">
            Primeira cidade
          </span>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Começando por Catalão-GO
          </h2>
          <p className="mx-auto max-w-[52ch] text-muted-foreground lg:mx-0">
            Os grandes comparadores olham só o e-commerce das capitais. O EconoMerc mora na
            gôndola física — e começa pelo interior, onde ninguém mais está olhando: mercados
            independentes de cidades médias e pequenas, a começar por Catalão.
          </p>
          <p className="mx-auto max-w-[52ch] text-sm text-muted-foreground lg:mx-0">
            Cada preço confirmado por alguém da região deixa a base mais forte para o próximo
            vizinho que for às compras.
          </p>
        </div>
      </div>
    </section>
  );
}

function MapPinBadge() {
  return (
    <div className="relative flex size-56 items-center justify-center sm:size-64" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-primary-soft" />
      <span className="absolute inset-6 rounded-full border border-dashed border-primary/30" />
      <span className="absolute inset-14 rounded-full bg-primary/10" />
      <span className="relative flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-2)]">
        <LuMapPin className="size-9" />
      </span>
    </div>
  );
}
