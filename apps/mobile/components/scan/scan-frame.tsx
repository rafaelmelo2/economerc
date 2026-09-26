import { palette } from "@economerc/design-tokens/native";
import { Flashlight, FlashlightOff, Keyboard, PackageSearch } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/lib/theme/use-theme-color";

// Viewfinder é sempre escuro (câmera ao vivo), então os controles usam cores fixas da paleta —
// não os tokens semânticos (que trocam com o tema do app). Mesma convenção de `ui/switch.tsx`.
const ICON_ON_SCRIM_COLOR = palette.grafite[0];

export interface ScanFrameProps {
  torchOn: boolean;
  onToggleTorch: () => void;
  onManualEntry: () => void;
  onNoBarcode: () => void;
  /** Banner curto sobre a moldura (ex.: "Código inválido", erro de leitura de nota). */
  banner?: string;
  /** Texto permanente exibido quando não há banner — muda quando o scan chega em "modo nota"
   * (`?intent=receipt`, vindo de "Finalizar compra" → "Ler a nota agora"). */
  hint?: string;
}

/**
 * Moldura do viewfinder + controles (lanterna, digitar código, sem código). Fica por cima da
 * `CameraView` real e é reaproveitada tal-e-qual pelo modo demo (`?demo=1`), que renderiza esta
 * mesma UI sobre um fundo estático — a câmera não roda em screenshot.
 */
export function ScanFrame({
  torchOn,
  onToggleTorch,
  onManualEntry,
  onNoBarcode,
  banner,
  hint = "Aponte para o código de barras",
}: ScanFrameProps) {
  const TorchIcon = torchOn ? Flashlight : FlashlightOff;
  const accentForegroundColor = useThemeColor("accent-foreground");

  return (
    <View className="flex-1 justify-between p-4">
      <View className="flex-row justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={torchOn ? "Desligar lanterna" : "Ligar lanterna"}
          accessibilityState={{ selected: torchOn }}
          hitSlop={8}
          onPress={onToggleTorch}
          className={`min-h-touch-min min-w-touch-min items-center justify-center rounded-pill ${
            torchOn ? "bg-accent" : "bg-scrim"
          }`}
        >
          <TorchIcon size={22} color={torchOn ? accentForegroundColor : ICON_ON_SCRIM_COLOR} strokeWidth={2} />
        </Pressable>
      </View>

      <View className="items-center gap-6">
        <View className="h-40 w-64 rounded-lg border-2 border-primary" />
        {banner ? (
          <View className="rounded-md bg-scrim px-4 py-2">
            <Text variant="callout" className="text-center text-grafite-0">
              {banner}
            </Text>
          </View>
        ) : (
          <Text variant="callout" className="text-center text-grafite-0">
            {hint}
          </Text>
        )}
      </View>

      <View className="flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Item sem código de barras"
          onPress={onNoBarcode}
          className="min-h-touch-min flex-1 flex-row items-center justify-center gap-2 rounded-md bg-scrim px-4"
        >
          <PackageSearch size={18} color={ICON_ON_SCRIM_COLOR} accessibilityLabel="" />
          <Text variant="callout" className="font-sans-semibold text-grafite-0">
            Sem código
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Digitar código de barras"
          onPress={onManualEntry}
          className="min-h-touch-min flex-1 flex-row items-center justify-center gap-2 rounded-md bg-scrim px-4"
        >
          <Keyboard size={18} color={ICON_ON_SCRIM_COLOR} accessibilityLabel="" />
          <Text variant="callout" className="font-sans-semibold text-grafite-0">
            Digitar código
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
