/**
 * Web Locks API — serializa TODO caller de refresh (interceptor de 401 + bootstrap) atrás do
 * MESMO lock (skill `auth` > auth-hardened.md §11). Sem isso, dois `/auth/refresh` concorrentes
 * são lidos como reuso pela rotação `family+used` do backend e derrubam a sessão inteira.
 */
export async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("economerc:auth-refresh", { mode: "exclusive" }, fn);
  }
  // Fallback: mesma aba, single-threaded JS — não há concorrência real pra serializar.
  return fn();
}
