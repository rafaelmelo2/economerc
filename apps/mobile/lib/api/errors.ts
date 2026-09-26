// Erro de API normalizado em pt-BR — todo `lib/api/*.ts` levanta isso em vez de
// devolver `res.data`/`res.status` crus pro chamador tratar na mão.

interface ApiErrorBody {
  detail?: unknown;
}

function extractDetail(body: unknown): string | null {
  const detail = (body as ApiErrorBody | null)?.detail;
  return typeof detail === "string" && detail.length > 0 ? detail : null;
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Sessão expirada. Entre novamente.";
  if (status === 403) return "Você não tem permissão para isso.";
  if (status === 404) return "Não encontrado.";
  if (status === 409) return "Conflito ao salvar — tente novamente.";
  if (status === 422) return "Dados inválidos.";
  if (status >= 500) return "Erro no servidor. Tente novamente em instantes.";
  return "Não foi possível completar a operação.";
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(extractDetail(body) ?? fallbackMessage(status));
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}
