import { Link, Stack } from "expo-router";
import { View } from "react-native";

import { Text } from "@/components/ui/text";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Não encontrado" }} />
      <View className="flex-1 items-center justify-center gap-3 bg-background px-6">
        <Text variant="title-2">Essa tela não existe.</Text>
        <Link href="/" className="text-primary">
          Voltar ao início
        </Link>
      </View>
    </>
  );
}
