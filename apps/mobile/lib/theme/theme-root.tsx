import { colorScheme, useColorScheme as useNativeWindColorScheme, vars } from "nativewind";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Appearance, Platform, View } from "react-native";

import { buildCssVars } from "./tokens";

function resolveSystemScheme(): "light" | "dark" {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

/**
 * Injeta as CSS vars do tema (claro/escuro) na raiz da árvore via `vars()`.
 *
 * NativeWind usa `darkMode: "class"` (necessário pro toggle manual em Perfil funcionar —
 * `colorScheme.set()`). Só que nesse modo, ao contrário do `"media"`, o NativeWind NÃO
 * observa o sistema sozinho: ele lê a classe `dark` do `<html>` uma única vez no import e
 * pronto. Por isso semeamos o valor do sistema aqui e escutamos mudanças do SO — o toggle
 * de Perfil continua funcionando por cima porque só reage a eventos reais de mudança do SO.
 */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { colorScheme: activeScheme } = useNativeWindColorScheme();

  useEffect(() => {
    colorScheme.set(resolveSystemScheme());
    const subscription = Appearance.addChangeListener(({ colorScheme: nextScheme }) => {
      colorScheme.set(nextScheme === "dark" ? "dark" : "light");
    });
    return () => subscription.remove();
  }, []);

  const scheme = activeScheme === "dark" ? "dark" : "light";

  // Web: `Modal`/react-native-web portais o conteúdo pra fora de `#root` (direto em
  // `document.body`, via `ReactDOM.createPortal`) — CSS custom properties só cascateiam por
  // ascendência no DOM, então uma sheet/dialog herdava zero var() e pintava tudo transparente.
  // Espelhar as mesmas vars em `:root` cobre qualquer conteúdo portado, sem duplicar a fonte
  // dos tokens. Nativo ignora (`vars()` do NativeWind já resolve via runtime, não CSS real).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const cssVars = buildCssVars(scheme);
    for (const [key, value] of Object.entries(cssVars)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [scheme]);

  return <View style={[{ flex: 1 }, vars(buildCssVars(scheme))]}>{children}</View>;
}

export { colorScheme, useColorScheme } from "nativewind";
