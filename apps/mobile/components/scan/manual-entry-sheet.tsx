import { useState } from "react";
import { Modal, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { validateGtin } from "@/lib/scan/gtin";

export interface ManualEntrySheetProps {
  visible: boolean;
  onCancel: () => void;
  onSubmit: (ean: string) => void;
}

/** Entrada manual do código de barras — mesmo destino do scan (lookup + folha de confirmação). */
export function ManualEntrySheet({ visible, onCancel, onSubmit }: ManualEntrySheetProps) {
  const [rawCode, setRawCode] = useState("");
  const validation = validateGtin(rawCode);
  const showError = rawCode.length > 0 && !validation.valid;

  function handleSubmit() {
    if (!validation.valid) return;
    onSubmit(validation.code);
    setRawCode("");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View className="flex-1 justify-end bg-scrim">
        <View className="gap-4 rounded-t-xl bg-surface p-6">
          <Text variant="title-3">Digitar código de barras</Text>
          <Input
            label="Código (EAN-13, EAN-8 ou UPC-A)"
            value={rawCode}
            onChangeText={setRawCode}
            keyboardType="numeric"
            inputMode="numeric"
            placeholder="7891000100103"
            autoFocus
            error={showError ? "Esse código não confere. Revise os números." : undefined}
          />
          <View className="flex-row gap-3 pb-2">
            <Button variant="outline" className="flex-1" onPress={onCancel}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={!validation.valid} onPress={handleSubmit}>
              Buscar
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
