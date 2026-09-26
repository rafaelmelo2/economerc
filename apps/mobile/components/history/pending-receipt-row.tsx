import { router } from "expo-router";
import { AlertCircle, Loader2, Send } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { ReceiptRow } from "@/lib/db/types";
import { useThemeColor } from "@/lib/theme/use-theme-color";

const STATUS_LABEL: Record<"queued" | "pending" | "processing" | "failed", string> = {
  queued: "Aguardando conexão…",
  pending: "Lendo sua nota…",
  processing: "Lendo sua nota…",
  failed: "Não foi possível ler essa nota",
};

/** Nota que ainda não virou compra no histórico (`queued`/`pending`/`processing`/`failed`) —
 * mantém a nota visível e acessível mesmo se o usuário sair da tela de acompanhamento. */
export function PendingReceiptRow({ row }: { row: ReceiptRow }) {
  const primaryColor = useThemeColor("primary");
  const dangerColor = useThemeColor("danger");
  const status = row.status as "queued" | "pending" | "processing" | "failed";
  const Icon = status === "failed" ? AlertCircle : status === "queued" ? Send : Loader2;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/receipt/[localId]", params: { localId: row.client_id } })}
      accessibilityRole="button"
      accessibilityLabel={`Acompanhar nota: ${STATUS_LABEL[status]}`}
      className="flex-row items-center gap-3 rounded-md bg-surface-muted p-3"
    >
      <Icon size={18} color={status === "failed" ? dangerColor : primaryColor} accessibilityLabel="" />
      <Text variant="callout" color={status === "failed" ? "danger" : "muted"} className="flex-1">
        {STATUS_LABEL[status]}
      </Text>
    </Pressable>
  );
}
