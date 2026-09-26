import { LuBadgeCheck, LuCroissant, LuMilk, LuWheat } from "react-icons/lu";

import { formatMoneyBRL, formatMoneyPerUnit } from "@/lib/money";

/**
 * Mock de celular em HTML/CSS puro (sem imagem) com a tela de carrinho — a mesma composição
 * de docs/brand/vitrine.html, reconstruída com os tokens da marca. Placeholder até as imagens
 * reais (docs/brand/prompts-imagens.md) existirem.
 */
export function PhoneCartMock() {
  return (
    <div
      className="relative flex h-[560px] w-[280px] flex-col overflow-hidden rounded-[40px] border-[8px] border-[var(--color-grafite-950)] bg-background shadow-[var(--shadow-3)] sm:h-[600px] sm:w-[300px]"
      aria-hidden
    >
      <div className="h-7 shrink-0" />
      <div className="flex flex-1 flex-col gap-3 overflow-hidden px-3 pb-2">
        <p className="text-xs text-muted-foreground">Compra em andamento · Bom Preço</p>

        <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-1)]">
          <div className="num font-display text-price-hero font-extrabold tracking-tight">
            {formatMoneyBRL(187.4)}
          </div>
          <div className="mt-2.5 h-2.5 overflow-hidden rounded-pill bg-secondary">
            <div className="h-full w-[73%] rounded-pill bg-primary" />
          </div>
          <p className="num mt-1.5 text-xs text-muted-foreground">
            73% do orçamento · faltam {formatMoneyBRL(62.6)}
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-warning-soft p-3 text-xs">
          <LuBadgeCheck className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            Café baixou <b className="num">{formatMoneyBRL(2)}</b> no Mercado Central esta semana.
          </span>
        </div>

        <CartItem
          icon={<LuWheat className="size-4" />}
          name="Café Pilão 500 g"
          detail={formatMoneyPerUnit(37.8, "kg")}
          price={formatMoneyBRL(18.9)}
        />
        <CartItem
          icon={<LuMilk className="size-4" />}
          name="Leite 1 L"
          detail={`6 un · ${formatMoneyPerUnit(4.49, "L")}`}
          price={formatMoneyBRL(26.94)}
          tag
        />
        <CartItem
          icon={<LuCroissant className="size-4" />}
          name="Pão francês 1 kg"
          detail={formatMoneyPerUnit(12.9, "kg")}
          price={formatMoneyBRL(12.9)}
        />
      </div>

      <div className="flex h-[68px] shrink-0 items-center justify-around border-t bg-card text-[11px] text-muted-foreground">
        <span className="font-semibold text-primary">Carrinho</span>
        <span>Listas</span>
        <span className="-mt-8 flex size-14 items-center justify-center rounded-pill bg-primary text-primary-foreground shadow-[var(--shadow-2)]">
          <ScanGlyph />
        </span>
        <span>Histórico</span>
        <span>Ofertas</span>
      </div>
    </div>
  );
}

function CartItem({
  icon,
  name,
  detail,
  price,
  tag,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  price: string;
  tag?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 shadow-[var(--shadow-1)]">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-[13px] leading-tight">
        {tag && (
          <span className="mb-0.5 mr-1.5 inline-flex rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent-foreground">
            OFERTA
          </span>
        )}
        <div className="truncate">{name}</div>
        <div className="num truncate text-xs text-muted-foreground">{detail}</div>
      </div>
      <div className="num shrink-0 text-sm font-semibold">{price}</div>
    </div>
  );
}

function ScanGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8" />
    </svg>
  );
}
