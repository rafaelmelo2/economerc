import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SheetProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  /** Ação primária fixa fora da área rolável, sempre inteira acima da safe-area
   * (conteúdo longo — categoria, quantidade, oferta — não empurra o botão pra
   * fora da tela em 390×844; ver `.claude/rules/mobile.md` > Layout). */
  footer?: ReactNode;
}

/** Base de sheet modal (fundo escurecido + cartão arredondado subindo de baixo, safe-area no rodapé). */
export function Sheet({ visible, onRequestClose, children, footer }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onRequestClose}>
      <View className="flex-1 justify-end bg-scrim">
        <Pressable className="absolute inset-0" onPress={onRequestClose} accessibilityLabel="Fechar" />
        <View className="max-h-[88%] overflow-hidden rounded-t-xl bg-surface">
          <View
            className="min-h-0 flex-1 px-6 pt-6"
            style={footer ? undefined : { paddingBottom: Math.max(insets.bottom, 16) + 8 }}
          >
            {children}
          </View>
          {footer ? (
            <View
              className="border-t border-border px-6 pt-3"
              style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
