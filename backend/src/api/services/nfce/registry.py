"""UF -> adaptador de NFC-e (docs/nfce-sefaz-go.md > Próximos estados).

UF sem adaptador cadastrado aqui = `receipts.status = 'failed'` com motivo
"UF ainda não suportada" (worker), nunca uma exceção não tratada.
"""

from typing import Final

from api.services.nfce.adapters.base import NfceAdapter
from api.services.nfce.adapters.go import go_adapter

_ADAPTERS_BY_STATE: Final[dict[str, NfceAdapter]] = {
    "GO": go_adapter,
}


def get_adapter(state_code: str) -> NfceAdapter | None:
    return _ADAPTERS_BY_STATE.get(state_code)
