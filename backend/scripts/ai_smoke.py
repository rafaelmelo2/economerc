"""Smoke test manual do cliente de IA — chama o OpenRouter de verdade.

Só roda a chamada real se `OPENROUTER_API_KEY` estiver no `.env`; caso
contrário, avisa e sai sem falhar (não quebra CI sem chave configurada).

Uso: `cd backend && uv run python scripts/ai_smoke.py`
"""

import asyncio
import sys

sys.path.insert(0, "src")

from api.services.ai.ai_client import complete
from config.settings import settings


async def main() -> None:
    if settings.openrouter_api_key is None:
        print("OPENROUTER_API_KEY ausente no .env — pulando chamada real de IA.")
        return

    result = await complete(
        "categorize_product",
        system_prompt=(
            "Você categoriza produtos de supermercado brasileiro em uma das categorias: "
            "Hortifruti, Laticínios, Mercearia, Bebidas, Carnes, Padaria, Congelados, "
            "Limpeza, Higiene, Outros. Responda só com o nome da categoria."
        ),
        user_text="Leite integral Itambé 1L",
    )
    print(f"modelo={result.model} categoria={result.content!r}")
    print(
        f"tokens(prompt={result.prompt_tokens}, completion={result.completion_tokens}) "
        f"custo_usd~={result.cost_usd:.6f} latencia_ms={result.latency_ms:.0f}"
    )


if __name__ == "__main__":
    asyncio.run(main())
