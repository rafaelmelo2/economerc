import type { MouseEvent, ReactNode } from "react";
import type { IconType } from "react-icons";
import { LuEllipsisVertical, LuLoader } from "react-icons/lu";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInfiniteScrollSentinel } from "@/hooks/useInfiniteList";
import { cn } from "@/lib/utils";

/**
 * Papel da coluna no card mobile (`.claude/rules/web.md` > Listas — tabela no desktop, card no
 * mobile, a partir da MESMA definição de coluna).
 */
export type DataListColumnRole = "primary" | "secondary" | "badge" | "meta" | "hidden";

export interface DataListColumn<T> {
  id: string;
  header: ReactNode;
  cell: (item: T) => ReactNode;
  role?: DataListColumnRole;
  renderCard?: (item: T) => ReactNode;
  className?: string;
}

export interface DataListAction<T> {
  id: string;
  label: string;
  icon: IconType;
  onSelect: (item: T) => void;
  destructive?: boolean;
  hidden?: (item: T) => boolean;
}

export interface DataListProps<T> {
  items: T[];
  columns: DataListColumn<T>[];
  getRowId: (item: T) => string;
  actions?: DataListAction<T>[];
  onRowClick?: (item: T) => void;
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  total: number;
  emptyTitle: string;
  emptyDescription?: string;
  className?: string;
}

const SKELETON_ROWS = 5;
const INLINE_ACTIONS_MAX = 2;

function isInteractiveClick(event: MouseEvent<HTMLElement>): boolean {
  if (!(event.target instanceof Element)) return false;
  return event.target.closest("a, button, input, label, [role='menuitem']") !== null;
}

function visibleActions<T>(actions: DataListAction<T>[], item: T) {
  return actions.filter((action) => !action.hidden?.(item));
}

function ActionButtons<T>({ actions, item }: { actions: DataListAction<T>[]; item: T }) {
  const available = visibleActions(actions, item);
  if (available.length === 0) return null;

  if (available.length > INLINE_ACTIONS_MAX) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ações">
            <LuEllipsisVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {available.map((action) => (
            <DropdownMenuItem
              key={action.id}
              variant={action.destructive ? "destructive" : undefined}
              onSelect={() => action.onSelect(item)}
            >
              <action.icon className="size-4" />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      {available.map((action) => (
        <Button
          key={action.id}
          variant="ghost"
          size="icon"
          aria-label={action.label}
          onClick={() => action.onSelect(item)}
        >
          <action.icon className={cn("size-4", action.destructive && "text-destructive")} />
        </Button>
      ))}
    </>
  );
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

function ResponsiveRows<T>({
  items,
  columns,
  getRowId,
  actions,
  onRowClick,
}: {
  items: T[];
  columns: DataListColumn<T>[];
  getRowId: (item: T) => string;
  actions: DataListAction<T>[];
  onRowClick?: (item: T) => void;
}) {
  const hasActions = actions.length > 0;
  // `columns` nunca é vazio na prática (toda tela de lista define pelo menos 1 coluna) — o
  // non-null assertion cobre só o caso improvável de definição vazia, sem forçar `| undefined`
  // no resto (`primary` guia o card mobile inteiro).
  const primary = columns.find((c) => c.role === "primary") ?? columns[0]!;
  const secondary = columns.filter((c) => c.role === "secondary");
  const badges = columns.filter((c) => c.role === "badge");
  const meta = columns.filter((c) => c !== primary && (c.role === "meta" || c.role === undefined));

  const cardContent = (column: DataListColumn<T>, item: T) =>
    column.renderCard ? column.renderCard(item) : column.cell(item);

  const rowClick = (item: T) => (event: MouseEvent<HTMLElement>) => {
    if (!onRowClick || isInteractiveClick(event)) return;
    onRowClick(item);
  };

  return (
    <>
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
              {hasActions && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={getRowId(item)}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={rowClick(item)}
              >
                {columns.map((column) => (
                  <TableCell key={column.id} className={column.className}>
                    {column.cell(item)}
                  </TableCell>
                ))}
                {hasActions && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <ActionButtons actions={actions} item={item} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {items.map((item) => {
          const actionsNode = hasActions ? (
            <div className="flex justify-end gap-1">
              <ActionButtons actions={actions} item={item} />
            </div>
          ) : null;

          return (
            <div
              key={getRowId(item)}
              onClick={rowClick(item)}
              className={cn(
                "rounded-lg border bg-card p-4",
                onRowClick && "cursor-pointer active:bg-muted/50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{cardContent(primary, item)}</div>
                  {secondary.map((column) => (
                    <div key={column.id} className="truncate text-xs text-muted-foreground">
                      {cardContent(column, item)}
                    </div>
                  ))}
                </div>
                {badges.length > 0 && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {badges.map((column) => (
                      <div key={column.id}>{cardContent(column, item)}</div>
                    ))}
                  </div>
                )}
              </div>

              {meta.length > 0 && (
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t pt-3 text-xs">
                  {meta.map((column) => (
                    <div key={column.id} className="contents">
                      <dt className="text-muted-foreground">{column.header}</dt>
                      <dd className="truncate text-right">{cardContent(column, item)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {actionsNode && <div className="mt-2 border-t pt-2">{actionsNode}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function LoadingRows<T>({ columns, hasActions }: { columns: DataListColumn<T>[]; hasActions: boolean }) {
  const columnCount = columns.length + (hasActions ? 1 : 0);
  return (
    <div className="space-y-3">
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id}>{column.header}</TableHead>
              ))}
              {hasActions && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <TableRow key={index}>
                {Array.from({ length: columnCount }, (_, cell) => (
                  <TableCell key={cell}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Lista canônica de coleção — tabela no desktop (≥768px), pilha de cards no mobile, scroll
 * infinito de 10 em 10 (`useInfiniteList`). */
export function DataList<T>({
  items,
  columns,
  getRowId,
  actions = [],
  onRowClick,
  isLoading,
  isFetching,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  total,
  emptyTitle,
  emptyDescription,
  className,
}: DataListProps<T>) {
  const sentinelRef = useInfiniteScrollSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage });

  if (isLoading) {
    return <LoadingRows columns={columns} hasActions={actions.length > 0} />;
  }

  if (items.length === 0) {
    return (
      <div className={cn("rounded-md border", className)}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  const dimming = isFetching && !isFetchingNextPage;

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn("transition-opacity", dimming && "pointer-events-none opacity-60")}>
        <ResponsiveRows items={items} columns={columns} getRowId={getRowId} actions={actions} onRowClick={onRowClick} />
      </div>

      <div className="flex flex-col items-center gap-2">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {isFetchingNextPage ? "Carregando mais…" : `${items.length} de ${total}`}
        </p>
        {hasNextPage && (
          <>
            <div ref={sentinelRef} aria-hidden className="h-10 w-full" />
            <Button variant="outline" size="sm" onClick={fetchNextPage} disabled={isFetchingNextPage}>
              {isFetchingNextPage && <LuLoader className="mr-2 size-4 animate-spin" />}
              Carregar mais
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
