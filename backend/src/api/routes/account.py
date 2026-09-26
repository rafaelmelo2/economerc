"""Router agregador do bloco 2A (auth + `/me`).

Mantém `centralizer.py` com UMA linha de `include_router` para este bloco —
menos superfície de conflito com os outros blocos da Onda 2 (2B/2C) editando
o mesmo arquivo compartilhado em paralelo.
"""

from fastapi import APIRouter

from api.routes.auth.auth import router as auth_router
from api.routes.users.me import router as me_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(me_router)
