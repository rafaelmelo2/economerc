import { palette } from "@economerc/design-tokens/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CameraPermissionGate } from "@/components/scan/camera-permission-gate";
import { ManualEntrySheet } from "@/components/scan/manual-entry-sheet";
import { ScanConfirmSheet, type ScanConfirmTarget } from "@/components/scan/scan-confirm-sheet";
import { ScanFrame } from "@/components/scan/scan-frame";
import { ScanToast } from "@/components/scan/toast";
import { Text } from "@/components/ui/text";
import type { CartItemRecord } from "@/lib/cart/contract";
import { buildDemoLookupResult, demoEanAt } from "@/lib/scan/demo-fixtures";
import { isNfceQrValue } from "@/lib/scan/nfce-qr";
import { validateGtin } from "@/lib/scan/gtin";
import { lookupProductByEan } from "@/lib/scan/product-lookup";

/** Mesmo código lido duas vezes em menos disso é ruído da câmera, não uma nova leitura. */
const SCAN_DEBOUNCE_MS = 1500;
const BANNER_DURATION_MS = 2200;

export default function ScanScreen() {
  // Params de dev/screenshot (`?demo=1&permission=denied`) — expo-router tipa `useLocalSearchParams`
  // pela rota (typed routes), não por um shape arbitrário; lemos como texto solto de propósito.
  const params = useLocalSearchParams() as Record<string, string | undefined>;
  const isDemo = params.demo === "1";
  const forcedDeniedPermission = isDemo && params.permission === "denied";

  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ScanConfirmTarget | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [addedItem, setAddedItem] = useState<CartItemRecord | null>(null);

  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoIndexRef = useRef(0);

  const showBanner = useCallback((text: string) => {
    setBanner(text);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setBanner(null), BANNER_DURATION_MS);
  }, []);

  const runLookup = useCallback(async (ean: string) => {
    setConfirmTarget({ kind: "scan", ean, lookup: null });
    const result = await lookupProductByEan(ean);
    setConfirmTarget({ kind: "scan", ean, lookup: result });
  }, []);

  /** Modo demo nunca bate na rede — a câmera (e o backend autenticado) não existem em screenshot. */
  const runDemoLookup = useCallback(() => {
    const index = demoIndexRef.current;
    demoIndexRef.current += 1;
    setConfirmTarget({ kind: "scan", ean: demoEanAt(index), lookup: buildDemoLookupResult(index) });
  }, []);

  function handleBarcodeScanned(data: string, type: string) {
    const now = Date.now();
    if (lastScanRef.current?.code === data && now - lastScanRef.current.at < SCAN_DEBOUNCE_MS) return;
    lastScanRef.current = { code: data, at: now };

    if (type === "qr") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showBanner(isNfceQrValue(data) ? "Leitura de nota chega em breve" : "Não reconhecemos esse QR code");
      return;
    }

    const validation = validateGtin(data);
    if (!validation.valid) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showBanner("Código inválido, tenta de novo");
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void runLookup(validation.code);
  }

  function handleManualSubmit(ean: string) {
    setManualEntryVisible(false);
    void runLookup(ean);
  }

  function handleAdded(item: CartItemRecord) {
    setAddedItem(item);
  }

  if (forcedDeniedPermission || (!isDemo && permission && !permission.granted)) {
    return (
      <CameraPermissionGate
        canAskAgain={isDemo ? false : (permission?.canAskAgain ?? true)}
        onRequestPermission={() => void requestPermission()}
        onManualEntry={() => setManualEntryVisible(true)}
      />
    );
  }

  if (!isDemo && permission === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-grafite-950" edges={["top", "bottom"]}>
        <ActivityIndicator color={palette.grafite[0]} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-grafite-950" edges={["top", "bottom"]}>
      <View className="flex-1">
        {isDemo ? (
          <View style={StyleSheet.absoluteFill} className="bg-grafite-950" />
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchOn}
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "qr"] }}
            onBarcodeScanned={({ data, type }) => handleBarcodeScanned(data, type)}
          />
        )}

        <ScanFrame
          torchOn={torchOn}
          onToggleTorch={() => setTorchOn((prev) => !prev)}
          onManualEntry={() => setManualEntryVisible(true)}
          onNoBarcode={() => setConfirmTarget({ kind: "no-code" })}
          banner={banner ?? undefined}
        />

        {isDemo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Simular leitura de código (modo demo)"
            onPress={runDemoLookup}
            className="absolute bottom-28 left-4 right-4 min-h-touch-min items-center justify-center rounded-md bg-primary"
          >
            <Text variant="callout" color="on-primary" className="font-sans-semibold">
              Simular leitura (demo)
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ManualEntrySheet
        visible={manualEntryVisible}
        onCancel={() => setManualEntryVisible(false)}
        onSubmit={handleManualSubmit}
      />

      <ScanConfirmSheet target={confirmTarget} onClose={() => setConfirmTarget(null)} onAdded={handleAdded} />

      {addedItem ? (
        <ScanToast
          message={`${addedItem.productName} adicionado ao carrinho`}
          onDismiss={() => setAddedItem(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
