"""Domínio de uploads (skill `uploads-storage`) — constantes greppable + path helpers.

Fase 1: só `user_uploads`, backend local (`backend/uploads/`, bind-mount `/app/uploads`
no compose). `{domain}` de cada path é uma constante daqui, nunca string solta.
"""

import os
from pathlib import Path
from uuid import UUID

# Domínios (`{domain}` no layout `users/{user_id}/{domain}/...`).
PRICE_TAG_PHOTOS = "price_tag_photos"

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_DEFAULT_UPLOADS_DIR = _BACKEND_DIR / "uploads"


def uploads_dir() -> Path:
    """Lido por chamada (nunca cacheado) — testes sobrescrevem via env `UPLOADS_DIR`."""
    return Path(os.environ.get("UPLOADS_DIR", str(_DEFAULT_UPLOADS_DIR)))


def user_dir(user_id: UUID) -> tuple[str, str]:
    """`users/{user_id}` — primeiros dois segmentos de todo path de upload do usuário."""
    return ("users", str(user_id))
