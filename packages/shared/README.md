# packages/shared — contrato compartilhado app ↔ web

Consumido por `apps/mobile` e `apps/web` (workspace do bun):

- **Tipos** TypeScript do domínio (camelCase)
- **Schemas Zod 4** de request/response (validação no form e no boundary da API)
- **Cliente da API** (`ApiClient`: rename camelCase ↔ snake_case, `PagedResponse<T>`, erro de rede em pt-BR)
- Enums compartilhados (fonte de preço, status de nota, categorias)

Regra: nada de React/React Native aqui — só TypeScript puro, para rodar nos dois lados.
A fonte da verdade do schema continua no backend (Pydantic); este pacote espelha.
