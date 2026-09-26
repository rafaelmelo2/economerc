import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "EconoMerc",
  slug: "economerc",
  scheme: "economerc",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "br.com.economerc.app",
    supportsTablet: false,
    usesAppleSignIn: true,
  },
  android: {
    package: "br.com.economerc.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0E6B47",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
    output: "static",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    "expo-apple-authentication",
    // Sem opções: client IDs em runtime via `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`
    // (google-signin.ts) — web já provisionado, iOS/Android ainda placeholders
    // (Android precisa do SHA-1 do build EAS). O dono adiciona
    // `GoogleService-Info.plist`/`google-services.json` quando existirem
    // (docs/fases-construcao.md > Depende de você).
    "@react-native-google-signin/google-signin",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0E6B47",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
  },
};

export default config;
