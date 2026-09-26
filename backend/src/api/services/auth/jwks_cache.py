"""Cache do JWKS (Google/Apple) no Valkey (skill `http-client` + `infra`).

JWKS muda raríssimo (rotação de chave dos provedores); buscar via HTTP a cada
verificação de id_token seria uma chamada externa por login. TTL curto o
bastante para pegar rotação sem esperar deploy.
"""

from typing import Final

import orjson
import structlog
from curl_cffi.requests import AsyncSession

from api.core.valkey_client import get_valkey, is_valkey_ready

log = structlog.get_logger(__name__)

JWKS_HTTP_TIMEOUT_SECONDS: Final = 10


async def fetch_jwks(*, url: str, cache_key: str, cache_ttl_seconds: int) -> dict:
    """Devolve o JWKS (`{"keys": [...]}`). Cache-aside no Valkey; sem Valkey

    disponível (ex.: teste sem lifespan), busca direto — nunca quebra a
    verificação por falta de cache.
    """
    if is_valkey_ready():
        cached = await get_valkey().get(cache_key)
        if cached:
            return orjson.loads(cached)

    async with AsyncSession() as session:
        response = await session.get(url, timeout=JWKS_HTTP_TIMEOUT_SECONDS, impersonate="chrome")
        response.raise_for_status()
        jwks = response.json()

    if is_valkey_ready():
        await get_valkey().setex(cache_key, cache_ttl_seconds, orjson.dumps(jwks))
    log.info("jwks_fetched", url=url, keys=len(jwks.get("keys", [])))
    return jwks
