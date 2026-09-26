// Google Sign-In nativo (rules/mobile.md > Login). Client IDs via
// `EXPO_PUBLIC_GOOGLE_CLIENT_ID_*` (placeholders até o dono provisionar o
// projeto Google Cloud — docs/fases-construcao.md > Depende de você).

import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    // `webClientId` é o que faz o Android devolver `idToken` preenchido
    // também (audience do id_token validado pelo backend via JWKS) — já
    // provisionado (docs/fases-construcao.md > Depende de você).
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export interface GoogleSignInResult {
  idToken: string;
}

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error("Login com Google cancelado.");
  }
  const { idToken } = response.data;
  if (!idToken) {
    throw new Error("O Google não retornou o id_token — confira o client ID configurado.");
  }
  return { idToken };
}

export async function signOutFromGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Best-effort — logout do app não pode falhar por causa disso.
  }
}
