import { router } from "expo-router";
import { LogOut, Moon, Pencil, Sun, SunMoon, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { formatCentsAsBRLInput, formatCentsToBRL, parseBRLInputToCents } from "@/lib/format/money";
import { useSessionStore } from "@/lib/store/session-store";
import { useSyncStatus } from "@/lib/sync/state-store";
import { colorScheme } from "@/lib/theme/theme-root";
import { useThemeColor } from "@/lib/theme/use-theme-color";

const THEME_OPTIONS = [
  { key: "light" as const, label: "Claro", Icon: Sun },
  { key: "dark" as const, label: "Escuro", Icon: Moon },
  { key: "system" as const, label: "Sistema", Icon: SunMoon },
];

const SYNC_STATUS_LABEL: Record<string, string> = {
  idle: "Sincronizado",
  syncing: "Sincronizando…",
  offline: "Sem conexão — dados salvos no aparelho",
  error: "Falha ao sincronizar",
};

export default function ProfileScreen() {
  const userName = useSessionStore((state) => state.userName);
  const onboarding = useSessionStore((state) => state.onboarding);
  const signOut = useSessionStore((state) => state.signOut);
  const deleteAccount = useSessionStore((state) => state.deleteAccount);
  const updateMonthlyBudget = useSessionStore((state) => state.updateMonthlyBudget);
  const syncStatus = useSyncStatus();

  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [themePreference, setThemePreference] = useState<"light" | "dark" | "system">("system");
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(formatCentsAsBRLInput(onboarding.monthlyBudgetCents));
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const iconColor = useThemeColor("foreground");
  const primaryColor = useThemeColor("primary");
  const dangerColor = useThemeColor("danger");

  async function handleDeleteAccount() {
    setDeleteDialogVisible(false);
    setIsLeaving(true);
    try {
      await deleteAccount();
      router.replace("/(auth)/welcome");
    } finally {
      setIsLeaving(false);
    }
  }

  async function handleSignOut() {
    setIsLeaving(true);
    try {
      await signOut();
      router.replace("/(auth)/welcome");
    } finally {
      setIsLeaving(false);
    }
  }

  async function saveBudget() {
    setIsSavingBudget(true);
    try {
      await updateMonthlyBudget(parseBRLInputToCents(budgetInput));
      setIsEditingBudget(false);
    } finally {
      setIsSavingBudget(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
        <Text variant="title-1">Perfil</Text>

        <Card className="gap-1">
          <Text variant="title-3">{userName ?? "Você"}</Text>
          <Text variant="footnote" color="muted">
            {onboarding.cityLabel ?? "Cidade não definida"} · família de {onboarding.familySize}{" "}
            {onboarding.familySize === 1 ? "pessoa" : "pessoas"}
          </Text>
          <Text variant="caption" color="muted">
            {SYNC_STATUS_LABEL[syncStatus.status] ?? syncStatus.status}
            {syncStatus.pendingCount > 0 ? ` · ${syncStatus.pendingCount} pendente(s)` : ""}
          </Text>
        </Card>

        <Card className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="callout" color="muted">
              Orçamento mensal
            </Text>
            {!isEditingBudget ? (
              <Pressable
                onPress={() => {
                  setBudgetInput(formatCentsAsBRLInput(onboarding.monthlyBudgetCents));
                  setIsEditingBudget(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Editar orçamento mensal"
                className="h-touch-min w-touch-min items-center justify-center"
              >
                <Pencil size={18} color={primaryColor} accessibilityLabel="" />
              </Pressable>
            ) : null}
          </View>

          {isEditingBudget ? (
            <View className="gap-3">
              <Input
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="numeric"
                inputMode="numeric"
                returnKeyType="done"
                className="text-title-2"
              />
              <View className="flex-row gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isSavingBudget}
                  onPress={() => setIsEditingBudget(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  loading={isSavingBudget}
                  onPress={() => void saveBudget()}
                >
                  Salvar
                </Button>
              </View>
            </View>
          ) : (
            <Text variant="title-2" className="tabular-nums">
              {formatCentsToBRL(onboarding.monthlyBudgetCents)}
            </Text>
          )}
        </Card>

        <Card className="gap-3">
          <Text variant="callout" color="muted">
            Tema
          </Text>
          <View className="flex-row gap-2">
            {THEME_OPTIONS.map(({ key, label, Icon }) => {
              const selected = themePreference === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setThemePreference(key);
                    colorScheme.set(key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Tema ${label}`}
                  className={`min-h-touch-min flex-1 items-center justify-center gap-1 rounded-md border py-2 ${
                    selected ? "border-primary bg-primary-soft" : "border-border bg-surface"
                  }`}
                >
                  <Icon size={18} color={selected ? primaryColor : iconColor} accessibilityLabel="" />
                  <Text variant="caption" color={selected ? "primary" : "foreground"}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Pressable
          onPress={() => void handleSignOut()}
          disabled={isLeaving}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          className="min-h-touch-min flex-row items-center gap-3 rounded-lg bg-surface p-4"
        >
          <LogOut size={20} color={iconColor} accessibilityLabel="" />
          <Text variant="callout" className="font-sans-medium">
            Sair da conta
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setDeleteDialogVisible(true)}
          disabled={isLeaving}
          accessibilityRole="button"
          accessibilityLabel="Excluir conta"
          className="min-h-touch-min flex-row items-center gap-3 rounded-lg bg-surface p-4"
        >
          <Trash2 size={20} color={dangerColor} accessibilityLabel="" />
          <Text variant="callout" color="danger" className="font-sans-medium">
            Excluir conta
          </Text>
        </Pressable>
      </ScrollView>

      <ConfirmDialog
        visible={deleteDialogVisible}
        title="Excluir conta"
        description="Isso apaga seus dados pessoais e o histórico de compras. Não dá pra desfazer."
        confirmLabel="Excluir conta"
        destructive
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => setDeleteDialogVisible(false)}
      />
    </SafeAreaView>
  );
}
