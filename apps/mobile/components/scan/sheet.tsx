import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SheetProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}

/** Base de sheet modal (fundo escurecido + cartão arredondado subindo de baixo, safe-area no rodapé). */
export function Sheet({ visible, onRequestClose, children }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onRequestClose}>
      <View className="flex-1 justify-end bg-scrim">
        <Pressable className="absolute inset-0" onPress={onRequestClose} accessibilityLabel="Fechar" />
        <View
          className="max-h-[88%] overflow-hidden rounded-t-xl bg-surface px-6 pt-6"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}
