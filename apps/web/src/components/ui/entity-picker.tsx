import { useState, type ReactNode, type UIEvent } from "react";
import { LuChevronsUpDown, LuPlus, LuX } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FIELD_TRIGGER_CLASS } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EntityListParams } from "@/hooks/useEntityList";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;
const MAX_LIMIT = 200;
const LOAD_MORE_THRESHOLD_PX = 32;

interface EntityListResult<T> {
  data?: { items: T[]; total: number };
  isFetching?: boolean;
}

interface EntityPickerProps<T> {
  useList: (params: EntityListParams, options: { enabled: boolean }) => EntityListResult<T>;
  value: string | null;
  valueLabel?: string | null;
  onChange: (id: string | null, label: string | null, item: T | null) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  renderItem?: (item: T) => ReactNode;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  createLabel?: string;
  onCreateNew?: () => void;
  clearable?: boolean;
  disabled?: boolean;
}

/**
 * Combobox de FK pesquisável no servidor (`.claude/rules/web.md` > FK em forms) — NUNCA
 * `Select` estático nem `Input` de UUID cru para uma entidade que cresce com o uso.
 */
export function EntityPicker<T>({
  useList,
  value,
  valueLabel,
  onChange,
  getId,
  getLabel,
  renderItem,
  placeholder,
  searchPlaceholder,
  emptyText,
  createLabel,
  onCreateNew,
  clearable = true,
  disabled = false,
}: EntityPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, isFetching } = useList({ search: query || undefined, limit }, { enabled: open });

  const items = data?.items ?? [];
  const hasMore = items.length < (data?.total ?? 0) && limit < MAX_LIMIT;
  const selected = value ? items.find((item) => getId(item) === value) : undefined;
  const selectedLabel = value ? (selected ? getLabel(selected) : (valueLabel ?? null)) : null;
  const canCreate = Boolean(createLabel && onCreateNew);

  const search = (next: string) => {
    setQuery(next);
    setLimit(PAGE_SIZE);
  };

  const toggle = (next: boolean) => {
    setOpen(next);
    if (!next) setLimit(PAGE_SIZE);
  };

  const loadMoreOnScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMore || isFetching) return;
    const list = event.currentTarget;
    const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (remaining <= LOAD_MORE_THRESHOLD_PX) {
      setLimit((current) => Math.min(current + PAGE_SIZE, MAX_LIMIT));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={toggle}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(FIELD_TRIGGER_CLASS, "flex flex-1 justify-between font-normal")}
          >
            <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
              {selectedLabel ?? placeholder}
            </span>
            <LuChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={search} />
            <CommandList onScroll={loadMoreOnScroll}>
              {items.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {isFetching ? "Carregando…" : emptyText}
                </p>
              )}
              {items.length > 0 && (
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={getId(item)}
                      value={getId(item)}
                      onSelect={() => {
                        onChange(getId(item), getLabel(item), item);
                        setOpen(false);
                      }}
                    >
                      {renderItem ? renderItem(item) : <span className="truncate">{getLabel(item)}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {hasMore && (
                <p className="py-2 text-center text-xs text-muted-foreground">Role para carregar mais…</p>
              )}
              {canCreate && (
                <>
                  {items.length > 0 && <CommandSeparator />}
                  <CommandGroup>
                    <CommandItem value="__create__" onSelect={() => onCreateNew?.()}>
                      <LuPlus className="size-4" />
                      {createLabel}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {clearable && value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Limpar seleção"
          onClick={() => onChange(null, null, null)}
        >
          <LuX className="size-4" />
        </Button>
      )}
    </div>
  );
}
