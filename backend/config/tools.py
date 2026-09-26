import os

import dotenv

dotenv.load_dotenv(override=False)


def getenv_or_raise_exception(key: str) -> str:
    """Lê uma env var obrigatória ou explode com mensagem clara (fail-fast)."""
    value = os.getenv(key)
    if not value:
        raise RuntimeError(f"{key} não está setada no .env")
    return value
