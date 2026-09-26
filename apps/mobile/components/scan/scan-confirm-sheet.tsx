import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { CategoryPicker } from "@/components/scan/category-picker";
import { QuantityField } from "@/components/scan/quantity-field";
import { Sheet } from "@/components/scan/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import {
  addCartItem,
  type CartItemRecord,
  type NewCartItemInput,
  type ProductUnit,
} from "@/lib/cart/contract";
import { formatObservedAgo } from "@/lib/format/date";
import { formatCentsAsBRLInput, parseBRLInputToCents } from "@/lib/format/money";
import { formatMilliToQuantityInput, parseQuantityInputToMilli } from "@/lib/format/quantity";
import type { ProductLookupResult } from "@/lib/scan/product-lookup";
import type { CategoryKey } from "@/lib/types";

const DEFAULT_CATEGORY: CategoryKey = "outros";
const DEFAULT_QUANTITY_MILLI = 1000;

export type ScanConfirmTarget =
  | { kind: "scan"; ean: string; lookup: ProductLookupResult | null } // lookup null = carregando
  | { kind: "no-code" };

export interface ScanConfirmSheetProps {
  target: ScanConfirmTarget | null;
  onClose: () => void;
  onAdded: (item: CartItemRecord) => void;
}

interface DraftState {
  name: string;
  category: CategoryKey;
  unit: ProductUnit;
  quantityText: string;
  priceCents: number;
  isOffer: boolean;
}

function buildDraft(target: ScanConfirmTarget): DraftState {
  if (target.kind === "no-code") {
    return {
      name: "",
      category: DEFAULT_CATEGORY,
      unit: "kg",
      quantityText: formatMilliToQuantityInput(DEFAULT_QUANTITY_MILLI, "kg"),
      priceCents: 0,
      isOffer: false,
    };
  }

  const found = target.lookup?.status === "found" ? target.lookup : null;
  const unit = found?.product.unit ?? "un";

  return {
    name: found?.product.name ?? "",
    category: DEFAULT_CATEGORY,
    unit,
    quantityText: formatMilliToQuantityInput(DEFAULT_QUANTITY_MILLI, unit),
    priceCents: found?.price?.amountCents ?? 0,
    isOffer: false,
  };
}

/** Título + microcopy do topo da folha, conforme `docs/brand/voz.md` → Scan. */
function headerCopy(target: ScanConfirmTarget): { title: string; subtitle: string | null } {
  if (target.kind === "no-code") {
    return { title: "Item sem código", subtitle: "Hortifruti e a granel: preencha na mão." };
  }
  if (target.lookup === null) {
    return { title: "Consultando…", subtitle: null };
  }
  if (target.lookup.status === "found") {
    if (target.lookup.price) {
      return { title: target.lookup.product.name, subtitle: null };
    }
    return {
      title: target.lookup.product.name,
      subtitle: "Achamos o produto, mas não o preço. Quanto está na etiqueta?",
    };
  }
  if (target.lookup.status === "not-found") {
    return { title: "Código novo por aqui", subtitle: "Cadastre rapidinho — ele já entra no carrinho." };
  }
  return {
    title: "Sem conexão com o catálogo",
    subtitle: "Cadastre esse item e ele entra no carrinho do mesmo jeito.",
  };
}

export function ScanConfirmSheet({ target, onClose, onAdded }: ScanConfirmSheetProps) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (target) setDraft(buildDraft(target));
    else setDraft(null);
    setSubmitting(false);
  }, [target]);

  const visible = target !== null;
  const loading = target?.kind === "scan" && target.lookup === null;
  const isNoCodeMode = target?.kind === "no-code";
  const isEditableProduct =
    isNoCodeMode || (target?.kind === "scan" && target.lookup?.status !== "found");

  const quantityMilli = draft ? parseQuantityInputToMilli(draft.quantityText, draft.unit) : 0;
  const totalCents = draft ? Math.round((draft.priceCents * quantityMilli) / 1000) : 0;
  const canSubmit = draft !== null && draft.priceCents > 0 && quantityMilli > 0 && draft.name.trim().length > 0;

  async function handleAdd() {
    if (!target || !draft || !canSubmit) return;
    setSubmitting(true);

    const found = target.kind === "scan" && target.lookup?.status === "found" ? target.lookup : null;
    const input: NewCartItemInput = {
      ean: target.kind === "scan" ? target.ean : null,
      productName: draft.name.trim(),
      category: draft.category,
      unit: draft.unit,
      unitPriceCents: draft.priceCents,
      quantityMilli,
      isOffer: draft.isOffer,
      productId: found?.product.productId ?? null,
    };

    const record = await addCartItem(input);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdded(record);
    onClose();
  }

  const { title, subtitle } = target ? headerCopy(target) : { title: "", subtitle: null };
  const knownPrice = target?.kind === "scan" && target.lookup?.status === "found" ? target.lookup.price : null;

  return (
    <Sheet visible={visible} onRequestClose={onClose}>
      {!draft || loading ? (
        <View className="items-center gap-3 py-10">
          <ActivityIndicator />
          <Text variant="body" color="muted">
            Consultando o produto…
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="min-h-0 flex-1"
        >
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View className="gap-4 pb-4">
              <View className="gap-1">
                <Text variant="title-3">{title}</Text>
                {subtitle ? (
                  <Text variant="callout" color="muted">
                    {subtitle}
                  </Text>
                ) : null}
              </View>

              {knownPrice ? (
                <View className="gap-1 rounded-md bg-surface-muted p-3">
                  <Text variant="callout" color="muted">
                    Preço sugerido em{" "}
                    <Text variant="callout" className="font-sans-semibold">
                      {knownPrice.marketName}
                    </Text>
                  </Text>
                  <Text variant="footnote" color={knownPrice.isStale ? "warning" : "muted"} className="tabular-nums">
                    {formatObservedAgo(knownPrice.observedAt)}
                    {knownPrice.isStale ? " · preço desatualizado" : ""}
                  </Text>
                </View>
              ) : null}

              {isEditableProduct ? (
                <Input
                  label="Nome do produto"
                  value={draft.name}
                  onChangeText={(text) => setDraft({ ...draft, name: text })}
                  placeholder="Ex.: Tomate salada"
                />
              ) : null}

              <View className="gap-1.5">
                <Text variant="callout" color="muted">
                  Preço {isEditableProduct ? "" : "(a etiqueta manda — edite se estiver diferente)"}
                </Text>
                <Input
                  value={formatCentsAsBRLInput(draft.priceCents)}
                  onChangeText={(text) => setDraft({ ...draft, priceCents: parseBRLInputToCents(text) })}
                  keyboardType="numeric"
                  inputMode="numeric"
                  accessibilityLabel="Preço"
                  className="text-title-3"
                />
              </View>

              <QuantityField
                unit={draft.unit}
                onChangeUnit={isNoCodeMode ? (unit) => setDraft({ ...draft, unit }) : undefined}
                quantityText={draft.quantityText}
                onChangeQuantityText={(text) => setDraft({ ...draft, quantityText: text })}
              />

              <CategoryPicker value={draft.category} onChange={(category) => setDraft({ ...draft, category })} />

              <View className="flex-row items-center justify-between rounded-md bg-surface-muted px-3 py-3">
                <Text variant="callout">Essa compra é uma oferta?</Text>
                <Switch value={draft.isOffer} onValueChange={(isOffer) => setDraft({ ...draft, isOffer })} />
              </View>

              <View className="flex-row items-baseline justify-between px-1">
                <Text variant="callout" color="muted">
                  Total do item
                </Text>
                <Text variant="price" className="tabular-nums">
                  {formatCentsAsBRLInput(totalCents)}
                </Text>
              </View>

              <Button size="lg" disabled={!canSubmit} loading={submitting} onPress={handleAdd}>
                Adicionar ao carrinho
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Sheet>
  );
}
