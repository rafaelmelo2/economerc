"""Valkey client singleton — UDS-only, async, escopo de cache (skill `infra`).

Fronteira: cache → Valkey, messaging → NATS. Nunca confunda os dois.

Auth: o Valkey em docker roda com `--requirepass ${VALKEY_PASSWORD}`, então o
client manda AUTH quando a senha está setada. Um Valkey nativo de host-dev
costuma rodar sem senha; se AUTH for enviado e o servidor não tiver
`requirepass`, `_connect` detecta a rejeição e tenta de novo sem AUTH.
"""

import structlog
import valkey.asyncio as valkey
from valkey.exceptions import ValkeyError

from config.cache import cache_config

log = structlog.get_logger(__name__)

_client: valkey.Valkey | None = None

_NO_SERVER_PASSWORD_MARKERS = ("without any password configured", "no password is set")


async def _connect(*, with_password: bool) -> valkey.Valkey:
    kwargs: dict = {"decode_responses": False}
    if with_password:
        kwargs["password"] = cache_config.VALKEY_PASSWORD
    client = valkey.Valkey.from_url(f"unix://{cache_config.VALKEY_SOCK_PATH}", **kwargs)
    try:
        await client.ping()
    except ValkeyError as exc:
        message = str(exc).lower()
        if with_password and any(marker in message for marker in _NO_SERVER_PASSWORD_MARKERS):
            await client.aclose()
            log.warning("valkey_auth_skipped_passwordless_server")
            return await _connect(with_password=False)
        raise
    return client


async def init_valkey() -> None:
    global _client
    if _client is not None:
        return
    _client = await _connect(with_password=bool(cache_config.VALKEY_PASSWORD))


async def close_valkey() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def get_valkey() -> valkey.Valkey:
    if _client is None:
        raise RuntimeError("valkey_not_initialized")
    return _client


def is_valkey_ready() -> bool:
    return _client is not None
