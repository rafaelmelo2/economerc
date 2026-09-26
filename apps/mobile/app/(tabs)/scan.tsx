import { Keyboard } from "lucide-react-native";
import { useState } from "react";
import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { CameraPlaceholder } from "@/components/scan/camera-placeholder";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export default function ScanScreen() {
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const foregroundColor = useThemeColor("foreground");

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-4 p-4">
        <CameraPlaceholder />
        <Button
          variant="secondary"
          size="lg"
          onPress={() => setManualEntryVisible(true)}
          className="flex-row gap-2"
        >
          <Keyboard size={20} color={foregroundColor} accessibilityLabel="" />
          <Text variant="callout" className="font-sans-semibold">
            Digitar código
          </Text>
        </Button>
      </View>

      <Modal visible={manualEntryVisible} transparent animationType="slide" onRequestClose={() => setManualEntryVisible(false)}>
        <View className="flex-1 justify-end bg-scrim">
          <View className="gap-4 rounded-t-xl bg-surface p-6">
            <Text variant="title-3">Digitar código de barras</Text>
            <Input
              label="Código (EAN-13 ou UPC-A)"
              value={manualCode}
              onChangeText={setManualCode}
              keyboardType="numeric"
              inputMode="numeric"
              placeholder="7891000100103"
              autoFocus
            />
            <View className="flex-row gap-3 pb-2">
              <Button variant="outline" className="flex-1" onPress={() => setManualEntryVisible(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={manualCode.length < 8}
                onPress={() => {
                  setManualEntryVisible(false);
                  setManualCode("");
                }}
              >
                Buscar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
