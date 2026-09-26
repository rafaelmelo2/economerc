"""OCR de etiqueta de gôndola (docs/roadmap-fase1.md > Etapa 6). Tarefa de IA
`price_tag_ocr` (visão, `config/app/{env}.yaml > ai.tasks`), saída estruturada
validada por Pydantic. Cache por hash da imagem (Valkey) — nunca paga duas
vezes pela mesma foto. O usuário confirma no app antes de virar preço; este
serviço só devolve a leitura, nunca grava em `prices`.
"""

import base64
from decimal import Decimal, InvalidOperation
from typing import Final, Literal

import orjson
import structlog
from pydantic import BaseModel, Field, ValidationError, field_validator
from valkey.asyncio import Valkey

from api.core.exceptions import BadGatewayError
from api.services.ai import ai_client
from api.services.ai.ai_client import AiProviderError, AiTaskNotConfiguredError

log = structlog.get_logger(__name__)

CACHE_KEY_PREFIX: Final = "cache:ocr:price_tag:"
CACHE_TTL_SECONDS: Final = 7 * 24 * 3600  # 7 dias — mesma foto reenviada não paga de novo

PriceTagUnit = Literal["un", "kg", "g", "l", "ml"]

PRICE_TAG_OCR_SYSTEM_PROMPT: Final = """\
Você lê etiquetas de preço de gôndola de supermercado brasileiro a partir de uma foto.
Extraia SOMENTE o que está escrito na etiqueta e responda em JSON estrito, sem texto fora do
JSON, no formato:

{
  "product_name": string (nome do produto como está na etiqueta),
  "price": string decimal (preço normal em reais, separador PONTO, sem "R$", ex.: "12.90"),
  "unit": "un" | "kg" | "g" | "l" | "ml",
  "price_per_unit": string decimal opcional (R$ por kg/L quando a etiqueta trouxer, ou o preço
    unitário efetivo em ofertas tipo atacado/"leve N pague M") ou null,
  "is_promo": boolean (true se houver qualquer indicação de promoção: "oferta", "promoção",
    "leve X pague Y", preço de atacado, preço riscado "de/por"),
  "promo_price": string decimal do preço promocional (o "por", quando a etiqueta trouxer
    "de R$X por R$Y") ou null,
  "confidence": number entre 0 e 1 — sua confiança na leitura desta etiqueta
}

Regras de leitura específicas do Brasil:
- Preços em reais na etiqueta usam vírgula como separador decimal ("R$ 12,90"); converta para
  ponto na resposta ("12.90").
- "cada" ao lado do preço indica unidade "un".
- "kg" ou "o quilo" indica preço por quilograma — se só houver preço por kg, use "kg" em `unit`.
- Ofertas tipo "leve 3 pague 2" ou preço de atacado (comprando N unidades) contam como promoção
  (`is_promo=true`); coloque o preço normal em `price` e, se der para calcular, o preço unitário
  efetivo da oferta em `price_per_unit`.
- Etiqueta borrada, incompleta ou sem preço legível: responda com a melhor leitura possível e
  `confidence` baixo (ex.: 0.3) — nunca invente um preço que não está na foto.
"""


class PriceTagOcrReading(BaseModel):
    product_name: str = Field(min_length=1, max_length=200)
    price: str
    unit: PriceTagUnit
    price_per_unit: str | None = None
    is_promo: bool
    promo_price: str | None = None
    confidence: float = Field(ge=0, le=1)

    @field_validator("price", "price_per_unit", "promo_price")
    @classmethod
    def _validate_decimal_string(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            Decimal(value)
        except InvalidOperation as exc:
            raise ValueError(f"valor decimal inválido: {value!r}") from exc
        return value


def _cache_key(image_hash: str) -> str:
    return f"{CACHE_KEY_PREFIX}{image_hash}"


async def _ask_ai_for_price_tag_reading(image_bytes: bytes) -> PriceTagOcrReading:
    try:
        completion = await ai_client.complete(
            "price_tag_ocr",
            system_prompt=PRICE_TAG_OCR_SYSTEM_PROMPT,
            user_text="Leia a etiqueta em anexo e responda só com o JSON pedido.",
            image_base64=base64.b64encode(image_bytes).decode("ascii"),
            json_output=True,
        )
    except (AiProviderError, AiTaskNotConfiguredError) as exc:
        log.warning("price_tag_ocr_call_failed", error=str(exc))
        raise BadGatewayError(
            detail="Não foi possível consultar o serviço de leitura de etiqueta agora. "
            "Tente de novo em instantes."
        ) from exc

    try:
        payload = orjson.loads(completion.content)
        return PriceTagOcrReading.model_validate(payload)
    except (orjson.JSONDecodeError, ValidationError) as exc:
        log.warning("price_tag_ocr_invalid_response", content=completion.content[:300])
        raise BadGatewayError(
            detail="Não foi possível entender a leitura da etiqueta. Tire a foto de novo, bem "
            "iluminada e enquadrando o preço, ou digite o preço manualmente."
        ) from exc


async def read_price_tag_photo(
    valkey: Valkey, image_bytes: bytes, *, image_hash: str
) -> tuple[PriceTagOcrReading, bool]:
    """Devolve `(leitura, veio_do_cache)`. Cache por hash — nunca chama a IA duas vezes
    pela mesma foto."""
    cached = await valkey.get(_cache_key(image_hash))
    if cached is not None:
        return PriceTagOcrReading.model_validate(orjson.loads(cached)), True

    reading = await _ask_ai_for_price_tag_reading(image_bytes)
    await valkey.set(
        _cache_key(image_hash), orjson.dumps(reading.model_dump()), ex=CACHE_TTL_SECONDS
    )
    return reading, False
