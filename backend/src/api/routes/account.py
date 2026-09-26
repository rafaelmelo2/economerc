"""Router agregador do bloco 2A (auth + `/me`).

Mantém `centralizer.py` com UMA linha de `include_router` para este bloco —
menos superfície de conflito com os outros blocos da Onda 2 (2B/2C) editando
o mesmo arquivo compartilhado em paralelo.
"""

import os

from fastapi import APIRouter

from api.routes.auth.auth import router as auth_router
from api.routes.users.me import router as me_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(me_router)


def is_dev_login_enabled() -> bool:
    """`POST /auth/dev-login` (onda 3A) só existe em `ENVIRONMENT=local` — o dono

    ainda não provisionou os client IDs Google/Apple reais
    (docs/fases-construcao.md > Depende de você). Fora de local a rota nunca é
    registrada: bate 404 puro, não 403/flag em runtime.
    """
    return os.getenv("ENVIRONMENT", "local") == "local"


if is_dev_login_enabled():
    from api.routes.auth.dev_login import router as dev_login_router

    router.include_router(dev_login_router)
