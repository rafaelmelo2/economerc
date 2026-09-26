import { useEffect } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { useReduceMotionEnabled } from "@/lib/theme/use-reduce-motion";

const AUTO_DISMISS_MS = 4000;

export interface ScanToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

/**
 * Toast genérico (fundo sempre escuro, independe do tema — mesma convenção do viewfinder da
 * câmera). Usado por "Item removido · Desfazer" (carrinho) e avisos de scan. Nunca `alert()`.
 */
export function ScanToast({ message, actionLabel, onAction, onDismiss }: ScanToastProps) {
  const reduceMotion = useReduceMotionEnabled();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const timeoutId = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara 1x por toast (identidade da mensagem)
  }, [message]);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown}
      exiting={reduceMotion ? undefined : FadeOutDown}
      accessibilityLiveRegion="polite"
      className="absolute inset-x-4 bottom-24 flex-row items-center justify-between gap-3 rounded-md bg-grafite-900 px-4 py-3"
    >
      <Text variant="callout" className="flex-1 text-grafite-0">
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          className="min-h-touch-min justify-center"
          onPress={() => {
            onAction();
            onDismiss();
          }}
        >
          <Text variant="callout" className="font-sans-semibold text-verde-400">
            {actionLabel}
          </Text>
        </Pressable>
      ) : (
        <View className="min-h-touch-min justify-center" />
      )}
    </Animated.View>
  );
}
