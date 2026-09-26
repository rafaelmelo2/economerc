/**
 * Cliente fetch mínimo tipado — boundary único onde camelCase (TS) vira
 * snake_case (API) e vice-versa. Components/hooks dos apps sempre veem
 * camelCase; nada de rename espalhado pelo código (`.claude/rules/web.md`).
 */

export interface ApiResponse<T> {
  data: T;
  status: number;
  success: boolean;
}

export const NETWORK_ERROR_MESSAGE = "Sem conexão com o servidor. Verifique sua internet.";

/** `TypeError` é o sinal cross-browser de falha de rede (fetch nunca resolve com 4xx/5xx aqui). */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

// `undefined` entra de propósito: reflete um `Record<string, T | undefined>`
// (campo opcional de um DTO Zod/TS) — `JSON.stringify` omite a chave, o mesmo
// efeito de "campo não enviado" que o backend espera em PATCH parciais.
// `readonly` no array cobre literais construídos com `as const`/tipos Zod.
export type JsonValue =
  | null
  | undefined
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { [key: string]: JsonValue };

/** Cast explícito e único pro boundary JSON — `payload?: undefined` em interface de request
 * (campo opcional) não é estruturalmente um `JsonValue` (que não inclui `undefined`), então
 * todo `ApiClient.post/patch` de um DTO próprio passa por aqui em vez de espalhar `as never`
 * pelos call sites. */
export function toJsonBody<T>(value: T): JsonValue {
  return value as unknown as JsonValue;
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, char: string) => char.toUpperCase());
}

function camelToSnake(key: string): string {
  return key.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
}

function transformKeys(value: unknown, convert: (key: string) => string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => transformKeys(item, convert));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        convert(key),
        transformKeys(val, convert),
      ]),
    );
  }
  return value;
}

type SearchParams = Record<string, string | number | boolean | undefined>;

export interface ApiClient {
  get<T>(path: string, searchParams?: SearchParams): Promise<ApiResponse<T>>;
  post<T>(path: string, body?: JsonValue): Promise<ApiResponse<T>>;
  patch<T>(path: string, body?: JsonValue): Promise<ApiResponse<T>>;
  delete<T>(path: string): Promise<ApiResponse<T>>;
}

function buildUrl(baseUrl: string, path: string, searchParams?: SearchParams): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(path.replace(/^\//, ""), base);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(camelToSnake(key), String(value));
  }
  return url.toString();
}

export interface ApiClientOptions {
  /** Lê o access token em memória — NUNCA localStorage/SecureStore direto aqui
   * (`.claude/rules/web.md` > Auth, `.claude/rules/mobile.md` > Auth). */
  getToken?: () => string | null | undefined;
  /** 401 na 1ª tentativa dispara isso (o app faz o refresh com lock — 1 renovação
   * por vez); resultado é o novo access token, ou `null` se o refresh falhou
   * (aí a resposta 401 original é devolvida ao caller, sem 2ª tentativa). */
  onUnauthorized?: () => Promise<string | null>;
  extraHeaders?: () => Record<string, string> | undefined;
}

/** Cliente fetch tipado — boundary único de rename + refresh-on-401 (retry único). */
export function createApiClient(baseUrl: string, options: ApiClientOptions = {}): ApiClient {
  const { getToken, onUnauthorized, extraHeaders } = options;

  async function request<T>(
    path: string,
    method: string,
    body?: JsonValue,
    searchParams?: SearchParams,
    isRetry = false,
  ): Promise<ApiResponse<T>> {
    const token = getToken?.();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extraHeaders?.(),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    let response: Response;
    try {
      response = await fetch(buildUrl(baseUrl, path, searchParams), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(transformKeys(body, camelToSnake)) : undefined,
      });
    } catch (error) {
      throw new Error(isNetworkError(error) ? NETWORK_ERROR_MESSAGE : String(error));
    }

    if (response.status === 401 && !isRetry && onUnauthorized) {
      const refreshedToken = await onUnauthorized();
      if (refreshedToken) return request<T>(path, method, body, searchParams, true);
    }

    const raw = response.status === 204 ? null : await response.json().catch(() => null);
    return {
      data: transformKeys(raw, snakeToCamel) as T,
      status: response.status,
      success: response.ok,
    };
  }

  return {
    get: (path, searchParams) => request(path, "GET", undefined, searchParams),
    post: (path, body) => request(path, "POST", body),
    patch: (path, body) => request(path, "PATCH", body),
    delete: (path) => request(path, "DELETE"),
  };
}
