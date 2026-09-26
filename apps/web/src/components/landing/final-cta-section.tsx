import { StoreBadges } from "@/components/landing/store-badges";

export function FinalCtaSection() {
  return (
    <section className="border-t bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 sm:py-20">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          Sua próxima compra já pode ter total certo
        </h2>
        <p className="max-w-[46ch] text-primary-foreground/85">
          Baixe o EconoMerc, entre com Google ou Apple e leve o carrinho no bolso na próxima ida
          ao mercado.
        </p>
        <StoreBadges className="justify-center" />
      </div>
    </section>
  );
}
