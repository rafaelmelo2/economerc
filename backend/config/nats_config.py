from typing import ClassVar

from config.settings import settings


class NatsConfig:
    """Configuração do servidor NATS (skill `infra`). JetStream ligado no compose."""

    NATS_URL: str = settings.nats.url
    NATS_SERVERS: ClassVar[list[str]] = [s.strip() for s in settings.nats.url.split(",")]
    NATS_NAME: str = settings.nats.name
    NATS_CONNECT_TIMEOUT: float = settings.nats.connect_timeout
    NATS_MAX_RECONNECT_ATTEMPTS: int = settings.nats.max_reconnect_attempts
    NATS_RECONNECT_TIME_WAIT: float = settings.nats.reconnect_time_wait


nats_config = NatsConfig()
