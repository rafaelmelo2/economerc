import { LuMapPin } from "react-icons/lu";

import { PhoneCartMock } from "@/components/landing/phone-cart-mock";
import { StoreBadges } from "@/components/landing/store-badges";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 900px 500px at 50% -10%, var(--primary-soft) 0%, transparent 65%)",
        }}
      />
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 items-center gap-10 px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:pt-20 lg:pb-24">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary-soft px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
            <LuMapPin className="size-3.5" />
            Catalão-GO
          </span>

          <h1 className="max-w-[16ch] font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
            Saiba quanto vai gastar antes do caixa.
          </h1>

          <p className="max-w-[46ch] text-base text-muted-foreground sm:text-lg">
            Escaneie os produtos no mercado e veja o total somar em tempo real contra o seu
            orçamento. Sem susto na hora de pagar, mesmo sem internet.
          </p>

          <StoreBadges className="justify-center lg:justify-start" />

          <p className="text-xs text-muted-foreground">
            Grátis para começar · Google e Apple para entrar, sem senha
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <PhoneCartMock />
        </div>
      </div>
    </section>
  );
}
