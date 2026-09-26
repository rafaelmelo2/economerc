"""Singleton de conexão NATS compartilhado pelo processo FastAPI (skill `infra`).

Bloco 1A só precisa do lifecycle (connect/close) e do healthcheck; streams e
consumers de domínio (`receipts.ingest`, etc.) entram nas ondas seguintes.
"""

import anyio
import nats
import structlog
from nats.aio.client import Client as NatsConnection
from nats.js import JetStreamContext

from config.nats_config import nats_config

log = structlog.get_logger(__name__)


class NatsClient:
    def __init__(self) -> None:
        self._nc: NatsConnection | None = None
        self._js: JetStreamContext | None = None
        self._lock = anyio.Lock()

    async def connect(self) -> None:
        async with self._lock:
            if self._nc is not None and self._nc.is_connected:
                return
            self._nc = await nats.connect(
                servers=nats_config.NATS_SERVERS,
                name=nats_config.NATS_NAME,
                connect_timeout=nats_config.NATS_CONNECT_TIMEOUT,
                max_reconnect_attempts=nats_config.NATS_MAX_RECONNECT_ATTEMPTS,
                reconnect_time_wait=nats_config.NATS_RECONNECT_TIME_WAIT,
                error_cb=self._on_error,
                disconnected_cb=self._on_disconnected,
                reconnected_cb=self._on_reconnected,
                closed_cb=self._on_closed,
            )
            self._js = self._nc.jetstream()
            log.info("nats_connected", servers=nats_config.NATS_SERVERS)

    async def close(self) -> None:
        async with self._lock:
            if self._nc is not None:
                try:
                    await self._nc.drain()
                except Exception:
                    log.exception("nats_drain_failed")
                self._nc = None
                self._js = None
                log.info("nats_closed")

    @property
    def is_connected(self) -> bool:
        return self._nc is not None and self._nc.is_connected

    def get_jetstream(self) -> JetStreamContext:
        if self._js is None:
            raise RuntimeError("nats_not_connected")
        return self._js

    async def _on_error(self, exc: Exception) -> None:
        log.warning("nats_error", error=repr(exc))

    async def _on_disconnected(self) -> None:
        log.warning("nats_disconnected")

    async def _on_reconnected(self) -> None:
        log.info("nats_reconnected")

    async def _on_closed(self) -> None:
        log.info("nats_connection_closed")


nats_client = NatsClient()
