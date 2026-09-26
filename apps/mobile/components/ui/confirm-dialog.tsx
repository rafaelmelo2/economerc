import { Modal, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação central e modal — força uma escolha (sem dismiss por fora), padrão para ações destrutivas. */
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-scrim px-6">
        <Pressable className="absolute inset-0" onPress={onCancel} accessibilityLabel="Fechar" />
        <View className="w-full max-w-sm gap-4 rounded-lg bg-surface p-6">
          <Text variant="title-3">{title}</Text>
          <Text variant="body" color="muted">
            {description}
          </Text>
          <View className="flex-row gap-3 pt-2">
            <Button variant="outline" onPress={onCancel} className="flex-1">
              {cancelLabel}
            </Button>
            <Button variant={destructive ? "destructive" : "primary"} onPress={onConfirm} className="flex-1">
              {confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
