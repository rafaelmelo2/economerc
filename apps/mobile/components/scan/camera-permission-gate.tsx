import * as Haptics from "expo-haptics";
import { Camera } from "lucide-react-native";
import { Linking, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export interface CameraPermissionGateProps {
  /** `false` quando o usuário já negou e o SO parou de perguntar (iOS) — só resta Ajustes. */
  canAskAgain: boolean;
  onRequestPermission: () => void;
  onManualEntry: () => void;
}

/**
 * Pré-tela de permissão de câmera, no tom da marca (`docs/brand/voz.md` → Scan). Nunca trava o
 * fluxo: "Digitar código" fica sempre disponível, mesmo sem câmera liberada.
 */
export function CameraPermissionGate({ canAskAgain, onRequestPermission, onManualEntry }: CameraPermissionGateProps) {
  const primaryColor = useThemeColor("primary");

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-6 px-8">
        <View className="h-20 w-20 items-center justify-center rounded-pill bg-primary-soft">
          <Camera size={36} color={primaryColor} accessibilityLabel="" />
        </View>
        <View className="gap-2">
          <Text variant="title-2" className="text-center">
            Precisamos da câmera
          </Text>
          <Text variant="body" color="muted" className="text-center">
            Pra escanear, o EconoMerc precisa da câmera. Você pode liberar em Ajustes.
          </Text>
        </View>
        <View className="w-full gap-3">
          {canAskAgain ? (
            <Button
              size="lg"
              onPress={() => {
                void Haptics.selectionAsync();
                onRequestPermission();
              }}
            >
              Permitir câmera
            </Button>
          ) : (
            <Button size="lg" onPress={() => Linking.openSettings()}>
              Abrir ajustes
            </Button>
          )}
          <Button variant="outline" size="lg" onPress={onManualEntry}>
            Digitar código
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
