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

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

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

/** `getToken` lê o access token em memória — NUNCA localStorage (`.claude/rules/web.md` > Auth). */
export function createApiClient(baseUrl: string, getToken?: () => string | null | undefined): ApiClient {
  async function request<T>(
    path: string,
    method: string,
    body?: JsonValue,
    searchParams?: SearchParams,
  ): Promise<ApiResponse<T>> {
    const token = getToken?.();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
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
