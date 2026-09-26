"""Fallback de IA (`flyer_extract`, OpenRouter) quando o regex pt-BR não basta (bloco 4C).

Chamado quando: (a) a mensagem é uma IMAGEM de encarte (regex não lê imagem), ou (b) o texto
não bateu com nenhum formato do `whatsapp_price_regex.py` mas parece ser uma oferta (tem
"R$" ou preço embutido que o regex não cobriu). Saída sempre validada por Pydantic — a IA
nunca escreve direto em `offer_candidates`.
"""

from decimal import Decimal, InvalidOperation
from typing import Final

import orjson
import structlog
from pydantic import BaseModel, Field, ValidationError

from api.services.ai.ai_client import AiProviderError, complete

log = structlog.get_logger(__name__)

FLYER_EXTRACT_TASK: Final = "flyer_extract"

_SYSTEM_PROMPT: Final = (
    "Você extrai ofertas de supermercado de uma mensagem de WhatsApp (texto e/ou imagem de "
    "encarte). Responda SOMENTE com um JSON no formato "
    '{"items": [{"product_name": str, "price_amount": "12.34", "unit": str|null, '
    '"valid_until": "YYYY-MM-DD"|null}]}. `price_amount` é string decimal com ponto (nunca '
    "vírgula). Ignore texto que não seja oferta de produto (saudação, endereço, etc). Se não "
    'houver nenhuma oferta reconhecível, responda {"items": []}.'
)


class FlyerExtractItem(BaseModel):
    product_name: str = Field(min_length=1, max_length=200)
    price_amount: Decimal
    unit: str | None = None
    valid_until: str | None = None


class FlyerExtractResult(BaseModel):
    items: list[FlyerExtractItem] = Field(default_factory=list)


async def extract_offers_via_ai(
    *, text: str | None, image_base64: str | None
) -> list[FlyerExtractItem]:
    """Chama `flyer_extract` e valida a resposta. Falha de IA/parsing = lista vazia (log e segue
    — a oferta se perde, mas não derruba o worker; próxima mensagem do grupo pode repetir)."""
    user_text = text or "(sem texto, só imagem)"
    try:
        result = await complete(
            FLYER_EXTRACT_TASK,
            system_prompt=_SYSTEM_PROMPT,
            user_text=user_text,
            image_base64=image_base64,
            json_output=True,
        )
    except AiProviderError:
        log.exception("flyer_extract_call_failed")
        return []

    try:
        payload = orjson.loads(result.content)
        parsed = FlyerExtractResult.model_validate(payload)
    except (orjson.JSONDecodeError, ValidationError, InvalidOperation):
        log.warning("flyer_extract_invalid_response", raw_content=result.content[:300])
        return []

    return parsed.items
