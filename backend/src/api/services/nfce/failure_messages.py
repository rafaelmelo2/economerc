"""Mensagem amigável pt-BR para nota fiscal com `status='failed'` (`docs/brand/voz.md`: número
primeiro quando fizer sentido, frase curta, diz o que houve e o que fazer, sem jargão fiscal —
"nota", nunca "NFC-e"). `failure_reason` (técnico, ex.: `NfceNotFoundError`/`NfceFetchError`
formatados) fica só no banco/logs; a API expõe as duas — o app mostra só `failure_message`.
"""

from typing import Final

UNSUPPORTED_STATE_MESSAGE: Final = (
    "Ainda não conseguimos consultar notas fiscais desse estado. Estamos expandindo aos poucos."
)
NOTE_NOT_FOUND_MESSAGE: Final = (
    "Não encontramos essa nota na SEFAZ. Confira se o QR é de um cupom fiscal de Goiás."
)
PORTAL_UNAVAILABLE_MESSAGE: Final = (
    "A consulta da nota está fora do ar agora. Tentamos de novo sozinhos e não conseguimos — "
    "você pode ler o QR de novo mais tarde."
)
GENERIC_FAILURE_MESSAGE: Final = (
    "Não conseguimos concluir a leitura dessa nota. Nossa equipe já foi avisada."
)

# Ordem importa: comparação por substring no `failure_reason` gravado pelo worker
# (`workers/receipts_worker.py` interpola a exceção original na string). Fica aqui, não em regex
# no worker, pra manter a mensagem de UI isolada da mecânica de retry/falha.
_UNSUPPORTED_STATE_REASON: Final = "uf ainda não suportada"
_NOT_FOUND_MARKERS: Final = (
    "não foi possível encontrar o xml da nota",
    "chave de acesso inválida",
    "sefaz-go:",  # prefixo que `NfceNotFoundError` sempre carrega (go.py > fetch)
)
_UNAVAILABLE_MARKERS: Final = ("falha ao consultar o portal da sefaz", "timeout", "rate limit")


def resolve_failure_message(status: str, failure_reason: str | None) -> str | None:
    """`None` fora de `status='failed'` — nada pra explicar num estado que ainda pode mudar."""
    if status != "failed" or not failure_reason:
        return None

    reason = failure_reason.lower()
    if reason == _UNSUPPORTED_STATE_REASON:
        return UNSUPPORTED_STATE_MESSAGE
    if any(marker in reason for marker in _NOT_FOUND_MARKERS):
        return NOTE_NOT_FOUND_MESSAGE
    if any(marker in reason for marker in _UNAVAILABLE_MARKERS):
        return PORTAL_UNAVAILABLE_MESSAGE
    return GENERIC_FAILURE_MESSAGE
