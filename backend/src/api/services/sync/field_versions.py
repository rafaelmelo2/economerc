"""LWW por campo (rules/mobile.md): compara `updated_at` da mutação contra o
`field_versions` já gravado, campo a campo. Compartilhado por cart e cart_item
— nenhuma lógica de domínio aqui, só a mecânica de merge.
"""

import datetime as dt
from typing import Any


def merge_field_versions(
    existing_versions: dict[str, str],
    incoming_fields: dict[str, Any],
    updated_at: dt.datetime,
) -> tuple[dict[str, Any], dict[str, str]]:
    """Decide quais campos da mutação vencem o LWW.

    Retorna `(campos_a_gravar, versões_a_gravar)` — só as chaves que venceram.
    Campo sem versão prévia (nunca editado; ficou no default de coluna) sempre
    vence. Empate (`updated_at == versão gravada`) NÃO vence — reenviar o
    mesmo lote duas vezes não reescreve nem gera novo `sync_changes`.
    """
    winning_fields: dict[str, Any] = {}
    winning_versions: dict[str, str] = {}
    for field_name, value in incoming_fields.items():
        stored_iso = existing_versions.get(field_name)
        stored_at = dt.datetime.fromisoformat(stored_iso) if stored_iso else None
        if stored_at is not None and updated_at <= stored_at:
            continue
        winning_fields[field_name] = value
        winning_versions[field_name] = updated_at.isoformat()
    return winning_fields, winning_versions


def latest_version(field_versions: dict[str, str], fallback: dt.datetime) -> dt.datetime:
    """`updated_at` visível da linha = versão mais recente entre os campos rastreados."""
    if not field_versions:
        return fallback
    return max(dt.datetime.fromisoformat(value) for value in field_versions.values())
