import os


class APIConfig:
    """Configuração de rede e metadados do servidor."""

    PROJECT_NAME = "economerc-backend"
    PROJECT_VERSION = "0.1.0"

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    API_PREFIX = "/api"


api_config = APIConfig()
