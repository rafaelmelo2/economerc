import { Redirect, Tabs } from "expo-router";
import { Clock, ScanLine, ShoppingCart, Tag, User } from "lucide-react-native";

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

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  if (!onboardingComplete) return <Redirect href="/(onboarding)/city" />;

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
          tabBarIcon: ({ color, focused }) => <Clock size={24} color={color} fill={focused ? color : "none"} />,
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
