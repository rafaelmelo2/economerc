"""Cliente único de IA — OpenRouter (API OpenAI-compatible), skill `http-client`.

Único provider desde a decisão do dono: modelos Gemini e outros seguem
disponíveis, só que servidos pelo OpenRouter. Cada tarefa (`ai.tasks.<nome>`
em `config/app/{env}.yaml`) escolhe modelo/temperatura/max_tokens — nunca
hardcode de modelo no código (`docs/arquitetura.md`).

Tarefas previstas (Fase 1): `price_tag_ocr` (visão), `categorize_product`
(texto, fallback da regra NCM), `flyer_extract` (visão, onda 4).
"""

import time
from dataclasses import dataclass
from typing import Any

import structlog
from curl_cffi.requests import AsyncSession

from config.settings import AiTaskSettings, settings

log = structlog.get_logger(__name__)

OPENROUTER_REFERER = "https://economerc.app"
OPENROUTER_APP_TITLE = "EconoMerc"
HTTP_ERROR_STATUS_THRESHOLD = 400

# Preço aproximado USD por 1M tokens (input, output) — best-effort, só para o
# log de custo aparecer nos primeiros meses. Confira https://openrouter.ai/models
# antes de reportar custo real ao usuário; não é fonte de cobrança.
_PRICE_TABLE_USD_PER_MILLION: dict[str, tuple[float, float]] = {
    "google/gemini-flash-latest": (0.30, 2.50),
    "google/gemini-2.5-flash-lite": (0.10, 0.40),
}
_DEFAULT_PRICE_USD_PER_MILLION = (0.50, 1.50)


class AiTaskNotConfiguredError(Exception):
    """`task` não existe em `ai.tasks` do yaml do ambiente atual."""


class AiProviderError(Exception):
    """OpenRouter respondeu erro, ou a chamada não pôde ser feita (sem API key)."""


@dataclass(frozen=True, slots=True)
class AiCompletionResult:
    task: str
    model: str
    content: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    latency_ms: float


def _task_config(task: str) -> AiTaskSettings:
    config = settings.ai.tasks.get(task)
    if config is None:
        raise AiTaskNotConfiguredError(
            f"tarefa de IA '{task}' não está em config/app/{{env}}.yaml > ai.tasks"
        )
    return config


def _estimate_cost_usd(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    input_price, output_price = _PRICE_TABLE_USD_PER_MILLION.get(
        model, _DEFAULT_PRICE_USD_PER_MILLION
    )
    return (prompt_tokens * input_price + completion_tokens * output_price) / 1_000_000


def _build_messages(
    system_prompt: str, user_text: str, image_base64: str | None
) -> list[dict[str, Any]]:
    user_content: Any = user_text
    if image_base64:
        user_content = [
            {"type": "text", "text": user_text},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
        ]
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


async def complete(
    task: str,
    *,
    system_prompt: str,
    user_text: str,
    image_base64: str | None = None,
    json_output: bool = False,
) -> AiCompletionResult:
    """Chama a tarefa configurada.

    `json_output=True` pede `response_format: json_object` ao provider — quem
    chama ainda faz `orjson.loads(result.content)` + valida (Pydantic); o
    client não conhece o schema de cada tarefa.
    """
    task_config = _task_config(task)
    api_key = settings.openrouter_api_key
    if api_key is None:
        raise AiProviderError("OPENROUTER_API_KEY não configurada — chamada de IA recusada")

    payload: dict[str, Any] = {
        "model": task_config.model,
        "messages": _build_messages(system_prompt, user_text, image_base64),
        "temperature": task_config.temperature,
        "max_tokens": task_config.max_tokens,
    }
    if json_output:
        payload["response_format"] = {"type": "json_object"}

    started_at = time.perf_counter()
    async with AsyncSession() as session:
        response = await session.post(
            f"{settings.ai.base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key.get_secret_value()}",
                "HTTP-Referer": OPENROUTER_REFERER,
                "X-Title": OPENROUTER_APP_TITLE,
            },
            json=payload,
            timeout=task_config.timeout_s,
            impersonate="chrome",
        )
    latency_ms = (time.perf_counter() - started_at) * 1000

    if response.status_code >= HTTP_ERROR_STATUS_THRESHOLD:
        log.warning(
            "ai_call_failed", task=task, model=task_config.model, status=response.status_code
        )
        raise AiProviderError(f"OpenRouter respondeu {response.status_code}: {response.text[:300]}")

    data = response.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    cost_usd = _estimate_cost_usd(task_config.model, prompt_tokens, completion_tokens)

    log.info(
        "ai_call_completed",
        task=task,
        provider="openrouter",
        model=task_config.model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost_usd=round(cost_usd, 6),
        latency_ms=round(latency_ms, 2),
    )

    return AiCompletionResult(
        task=task,
        model=task_config.model,
        content=content,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
    )
