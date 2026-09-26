// Sign in with Apple (rules/mobile.md > Login — só iOS). `fullName` só vem no
// 1º login; o backend persiste nessa hora (`AppleLoginRequest.full_name`).

import * as AppleAuthentication from "expo-apple-authentication";

export interface AppleSignInResult {
  identityToken: string;
  fullName: string | null;
}

function formatFullName(name: AppleAuthentication.AppleAuthenticationFullName | null): string | null {
  if (!name) return null;
  const parts = [name.givenName, name.familyName].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  return parts.length > 0 ? parts.join(" ") : null;
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error("A Apple não retornou o identity_token.");
  }
  return { identityToken: credential.identityToken, fullName: formatFullName(credential.fullName) };
}

export function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}
