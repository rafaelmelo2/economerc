import { Redirect, Tabs, useGlobalSearchParams } from "expo-router";
import { Clock, ScanLine, ShoppingCart, Tag, User } from "lucide-react-native";
import { useEffect, useState } from "react";

import { ScanTabButton } from "@/components/navigation/scan-tab-button";
import { useSessionStore } from "@/lib/store/session-store";
import { useThemeColor } from "@/lib/theme/use-theme-color";

export default function TabsLayout() {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const onboardingComplete = useSessionStore((state) => state.onboardingComplete);

  const activeColor = useThemeColor("primary");
  const inactiveColor = useThemeColor("foreground-muted");
  const surfaceColor = useThemeColor("surface");
  const borderColor = useThemeColor("border");

  // `?demo=1` pula login/onboarding — só existe pra validar UI sem câmera (Playwright/CI),
  // ver `lib/scan/demo-fixtures.ts`. Nunca acontece em uso real (ninguém digita isso). "Trava"
  // no primeiro render porque trocar de aba (tab bar do React Navigation) não repassa a
  // query string pras outras abas — e esse layout não desmonta entre abas irmãs.
  const params = useGlobalSearchParams() as Record<string, string | undefined>;
  const [demoPreviewLatched, setDemoPreviewLatched] = useState(false);
  useEffect(() => {
    if (params.demo === "1") setDemoPreviewLatched(true);
  }, [params.demo]);
  const isDemoPreview = demoPreviewLatched || params.demo === "1";

  if (!isDemoPreview) {
    if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
    if (!onboardingComplete) return <Redirect href="/(onboarding)/city" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: { backgroundColor: surfaceColor, borderTopColor: borderColor, height: 76 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Carrinho",
          tabBarIcon: ({ color, focused }) => (
            <ShoppingCart size={24} color={color} fill={focused ? color : "none"} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Histórico",
          // `Clock` preenchido vira uma bolinha sólida (o ponteiro, do mesmo traço da cor,
          // some dentro do disco cheio) — ao contrário de ícones fechados (carrinho, tag,
          // pessoa), ele não tem um "preenchido" que funcione. Estado ativo só por cor + traço.
          tabBarIcon: ({ color, focused }) => <Clock size={24} color={color} strokeWidth={focused ? 2.5 : 2} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarButton: (props) => <ScanTabButton {...props} />,
          tabBarIcon: ({ color }) => <ScanLine size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: "Ofertas",
          tabBarIcon: ({ color, focused }) => <Tag size={24} color={color} fill={focused ? color : "none"} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, focused }) => <User size={24} color={color} fill={focused ? color : "none"} />,
        }}
      />
    </Tabs>
  );
}
