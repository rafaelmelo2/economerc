import { useEffect, useRef, useState, type ReactNode } from "react";
import { LuSearch, LuX } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Espelha `MIN_SEARCH_LENGTH` do backend (`routes/shared/list_params.py`). */
export const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 300;

/** Campo de busca com debounce — o texto em digitação é o ÚNICO `useState` legítimo de uma
 * tela de lista (buffer transitório de teclas); o filtro commitado mora na URL. */
export function SearchInput({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string | undefined;
  onCommit: (next: string | undefined) => void;
  placeholder: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const committed = useRef(value ?? "");

  useEffect(() => {
    const next = value ?? "";
    if (next !== committed.current) {
      committed.current = next;
      setDraft(next);
    }
  }, [value]);

  useEffect(() => {
    const term = draft.trim();
    const next = term.length >= MIN_SEARCH_LENGTH ? term : "";
    if (next === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = next;
      onCommit(next || undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, onCommit]);

  return (
    <div className={cn("relative w-full sm:max-w-sm", className)}>
      <LuSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        type="search"
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {draft && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Limpar busca"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => setDraft("")}
        >
          <LuX className="size-4" />
        </Button>
      )}
    </div>
  );
}

export interface ListToolbarProps {
  search?: string;
  onSearchChange?: (next: string | undefined) => void;
  searchPlaceholder?: string;
  /** Selects/toggles de filtro da entidade — sempre visíveis (busca+filtros ficam em UMA
   * linha que quebra no mobile via `flex-wrap`). */
  filters?: ReactNode;
  activeFilterCount?: number;
  onClearFilters?: () => void;
  /** Botão de criar e afins. SEMPRE aqui, nunca abaixo da lista (scroll infinito). */
  actions?: ReactNode;
  className?: string;
}

/** Toolbar canônica de tela de lista — busca + filtros + ações, sempre ACIMA da lista. */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilterCount = 0,
  onClearFilters,
  actions,
  className,
}: ListToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onSearchChange ? (
          <SearchInput
            value={search}
            onCommit={onSearchChange}
            placeholder={searchPlaceholder ?? "Buscar…"}
            className="flex-1"
          />
        ) : (
          <div className="hidden flex-1 sm:block" />
        )}
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      {filters && (
        <div className="flex flex-wrap items-center gap-2">
          {filters}
          {activeFilterCount > 0 && onClearFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
