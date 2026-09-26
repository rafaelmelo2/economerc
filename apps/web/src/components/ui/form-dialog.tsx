import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: keyof typeof SIZE_CLASS;
  /** Ação afirmativa — NUNCA um botão "Cancelar/Fechar" (o X + click-fora já cobrem a saída,
   * `.claude/rules/web.md` > Overlays). */
  footer?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Overlay canônico para QUALQUER dialog com campo de formulário (`.claude/rules/web.md` >
 * Form dialogs). Três faixas — header fixo / corpo rolável / footer fixo — sobre a geometria
 * já à prova de viewport da base de `ui/dialog.tsx` (`max-h` + `overflow-y-auto` únicos, trava
 * `max-md:` para o celular).
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  footer,
  bodyClassName,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("flex flex-col gap-0 overflow-hidden p-0", SIZE_CLASS[size])}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4", bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div
            className="flex shrink-0 flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
          >
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
