import { useEffect, useState } from "react";
import { View } from "react-native";

import { Sheet } from "@/components/scan/sheet";
import { QuantityField } from "@/components/scan/quantity-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { updateCartItem, type CartItemRecord } from "@/lib/cart/contract";
import { formatCentsAsBRLInput, parseBRLInputToCents } from "@/lib/format/money";
import { formatMilliToQuantityInput, parseQuantityInputToMilli } from "@/lib/format/quantity";

export interface CartItemEditSheetProps {
  item: CartItemRecord | null;
  onClose: () => void;
  onRemove: (item: CartItemRecord) => void;
}

/** Editar quantidade/preço/oferta de um item já no carrinho. Remover fica aqui também (com desfazer). */
export function CartItemEditSheet({ item, onClose, onRemove }: CartItemEditSheetProps) {
  const [priceCents, setPriceCents] = useState(0);
  const [quantityText, setQuantityText] = useState("");
  const [isOffer, setIsOffer] = useState(false);

  useEffect(() => {
    if (!item) return;
    setPriceCents(item.unitPriceCents);
    setQuantityText(formatMilliToQuantityInput(item.quantityMilli, item.unit));
    setIsOffer(item.isOffer);
  }, [item]);

  if (!item) return null;

  const quantityMilli = parseQuantityInputToMilli(quantityText, item.unit);
  const canSave = priceCents > 0 && quantityMilli > 0;

  async function handleSave() {
    if (!item || !canSave) return;
    await updateCartItem(item.clientId, { unitPriceCents: priceCents, quantityMilli, isOffer });
    onClose();
  }

  return (
    <Sheet visible={item !== null} onRequestClose={onClose}>
      <View className="gap-4 pb-2">
        <Text variant="title-3">{item.productName}</Text>

        <View className="gap-1.5">
          <Text variant="callout" color="muted">
            Preço
          </Text>
          <Input
            value={formatCentsAsBRLInput(priceCents)}
            onChangeText={(text) => setPriceCents(parseBRLInputToCents(text))}
            keyboardType="numeric"
            inputMode="numeric"
            accessibilityLabel="Preço"
            className="text-title-3"
          />
        </View>

        <QuantityField unit={item.unit} quantityText={quantityText} onChangeQuantityText={setQuantityText} />

        <View className="flex-row items-center justify-between rounded-md bg-surface-muted px-3 py-3">
          <Text variant="callout">Essa compra é uma oferta?</Text>
          <Switch value={isOffer} onValueChange={setIsOffer} />
        </View>

        <View className="flex-row gap-3 pt-2">
          <Button variant="outline" className="flex-1" onPress={() => onRemove(item)}>
            Remover
          </Button>
          <Button className="flex-1" disabled={!canSave} onPress={handleSave}>
            Salvar
          </Button>
        </View>
      </View>
    </Sheet>
  );
}
