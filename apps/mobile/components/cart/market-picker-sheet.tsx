// "Em qual mercado você está?" (bloco 6, docs/produto.md) — seletor de mercados da cidade
// ativa, com busca por nome, cache local (offline) e "Outro mercado" (nome livre, sem
// `market_id` — só registra o nome por enquanto). Aberto no primeiro scan de um carrinho sem
// mercado e no cabeçalho do carrinho (tocar pra trocar), `app/(tabs)/index.tsx`/`scan.tsx`.

import { FlashList } from "@shopify/flash-list";
import { Check } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Sheet } from "@/components/scan/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { getDb } from "@/lib/db/client";
import { listCachedMarketsByCity, upsertCachedMarkets } from "@/lib/db/markets-cache-repository";
import { listMarketsByCity } from "@/lib/api/markets";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export interface MarketPickerOption {
  id: string;
  tradeName: string;
}

export interface MarketPickerSheetProps {
  visible: boolean;
  cityId: string | null;
  currentMarketId: string | null;
  onClose: () => void;
  onSelectMarket: (market: MarketPickerOption) => void;
  onSelectOther: (freeTextName: string) => void;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Carrega da rede (e atualiza o cache); sem rede, cai pro cache local — nunca trava o seletor. */
function useCityMarkets(cityId: string | null, visible: boolean) {
  const [markets, setMarkets] = useState<MarketPickerOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !cityId) return;
    let cancelled = false;
    setLoading(true);

    const db = getDb();
    const cached = listCachedMarketsByCity(db, cityId).map((row) => ({
      id: row.id,
      tradeName: row.trade_name,
    }));
    if (cached.length > 0) setMarkets(cached);

    void listMarketsByCity(cityId)
      .then((fresh) => {
        if (cancelled) return;
        upsertCachedMarkets(
          db,
          cityId,
          fresh.map((market) => ({
            id: market.id,
            tradeName: market.tradeName,
            address: market.address,
            isPartner: market.isPartner,
          })),
        );
        setMarkets(fresh.map((market) => ({ id: market.id, tradeName: market.tradeName })));
      })
      .catch(() => {
        // Offline/erro — o cache local (se havia) já está na tela; sem cache, lista fica vazia
        // e "Outro mercado" continua disponível.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId, visible]);

  return { markets, loading };
}

export function MarketPickerSheet({
  visible,
  cityId,
  currentMarketId,
  onClose,
  onSelectMarket,
  onSelectOther,
}: MarketPickerSheetProps) {
  const [query, setQuery] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherMode, setOtherMode] = useState(false);
  const primaryColor = useThemeColor("primary");
  const { markets, loading } = useCityMarkets(cityId, visible);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setOtherName("");
      setOtherMode(false);
    }
  }, [visible]);

  const filteredMarkets = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (normalizedQuery.length === 0) return markets;
    return markets.filter((market) => normalize(market.tradeName).includes(normalizedQuery));
  }, [markets, query]);

  function handleConfirmOther() {
    const trimmed = otherName.trim();
    if (trimmed.length === 0) return;
    onSelectOther(trimmed);
  }

  return (
    <Sheet visible={visible} onRequestClose={onClose}>
      <View className="min-h-0 flex-1 gap-4 pb-4">
        <View className="gap-1">
          <Text variant="title-3">Em qual mercado você está?</Text>
          <Text variant="callout" color="muted">
            O preço que você confirmar aqui ajuda todo mundo que compra nesse mercado.
          </Text>
        </View>

        {otherMode ? (
          <View className="gap-3">
            <Input
              label="Nome do mercado"
              value={otherName}
              onChangeText={setOtherName}
              placeholder="Ex.: Quitanda do seu Zé"
              autoFocus
            />
            <View className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onPress={() => setOtherMode(false)}>
                Voltar
              </Button>
              <Button className="flex-1" disabled={otherName.trim().length === 0} onPress={handleConfirmOther}>
                Usar esse nome
              </Button>
            </View>
          </View>
        ) : (
          <>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar mercado pelo nome"
              accessibilityLabel="Buscar mercado pelo nome"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {loading && markets.length === 0 ? (
              <View className="items-center py-8">
                <ActivityIndicator color={primaryColor} />
              </View>
            ) : (
              <View className="min-h-0 flex-1">
                <FlashList<MarketPickerOption>
                  data={filteredMarkets}
                  keyExtractor={(market) => market.id}
                  renderItem={({ item: market }) => {
                    const selected = market.id === currentMarketId;
                    return (
                      <Pressable
                        onPress={() => onSelectMarket(market)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        className={`min-h-touch-min flex-row items-center justify-between rounded-md border px-4 py-3 ${
                          selected ? "border-primary bg-primary-soft" : "border-border bg-surface"
                        }`}
                      >
                        <Text variant="callout" className="flex-1 font-sans-medium">
                          {market.tradeName}
                        </Text>
                        {selected ? (
                          <Check size={20} color={primaryColor} accessibilityLabel="Selecionado" />
                        ) : null}
                      </Pressable>
                    );
                  }}
                  ItemSeparatorComponent={() => <View className="h-2" />}
                  ListEmptyComponent={
                    <Text variant="callout" color="muted" className="py-2 text-center">
                      Nenhum mercado encontrado com esse nome.
                    </Text>
                  }
                  showsVerticalScrollIndicator={false}
                />
              </View>
            )}

            <Button variant="outline" onPress={() => setOtherMode(true)}>
              Outro mercado
            </Button>
          </>
        )}
      </View>
    </Sheet>
  );
}
