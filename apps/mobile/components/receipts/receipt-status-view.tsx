import { CheckCircle2, Copy, RefreshCcw } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/lib/theme/use-theme-color";
import type { ReceiptQueueStatus } from "@/lib/db/types";

export interface ReceiptStatusViewProps {
  status: ReceiptQueueStatus;
  failureReason: string | null;
  failureMessage: string | null;
}

/** Estados de acompanhamento da nota (`docs/brand/voz.md` > Nota fiscal) — pendente/processando
 * (mesmo texto: o usuário não distingue as duas), falhou, e o caso especial de duplicada com
 * texto amigável (item 2 do escopo), tratado à parte de "falhou" (não é um erro). */
export function ReceiptStatusView({ status, failureReason, failureMessage }: ReceiptStatusViewProps) {
  const primaryColor = useThemeColor("primary");
  const dangerColor = useThemeColor("danger");
  const mutedColor = useThemeColor("foreground-muted");

  if (status === "queued" || status === "pending" || status === "processing") {
    return (
      <View className="items-center gap-4 py-12">
        <ActivityIndicator size="large" color={primaryColor} />
        <Text variant="title-3" className="text-center">
          Lendo sua nota…
        </Text>
        <Text variant="body" color="muted" className="text-center">
          isso leva alguns segundos.
        </Text>
      </View>
    );
  }

  if (status === "failed") {
    return (
      <View className="items-center gap-4 py-12 px-4">
        <View className="h-14 w-14 items-center justify-center rounded-pill bg-danger-soft">
          <RefreshCcw size={26} color={dangerColor} accessibilityLabel="" />
        </View>
        <Text variant="title-3" className="text-center">
          Não conseguimos ler essa nota agora
        </Text>
        <Text variant="body" color="muted" className="text-center">
          {failureMessage ??
            "A consulta da nota está fora do ar agora. Vamos tentar de novo sozinhos e te avisamos."}
        </Text>
        {failureReason ? (
          <Text variant="footnote" color="muted" className="text-center">
            Detalhe técnico: {failureReason}
          </Text>
        ) : null}
      </View>
    );
  }

  // duplicate — market/total já vêm preenchidos (copiados da nota canônica), só o aviso muda.
  return (
    <View className="flex-row items-center gap-3 rounded-md bg-surface-muted p-3">
      <Copy size={20} color={mutedColor} accessibilityLabel="" />
      <Text variant="callout" color="muted" className="flex-1">
        Essa nota já tinha sido lida por você — aqui está o que já sabemos dela.
      </Text>
    </View>
  );
}

export function ReceiptDoneBadge() {
  const primaryColor = useThemeColor("primary");
  return <CheckCircle2 size={20} color={primaryColor} accessibilityLabel="Nota lida" />;
}
