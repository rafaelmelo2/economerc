"""Parse do QR Code da NFC-e (docs/nfce-sefaz-go.md) — funções puras, sem I/O.

Cobre QR v2 (hash do CSC, notas antigas) e v3 (obrigatório desde a NT 2025.001). O
parâmetro `p` é sempre `<chave_acesso>|<versao_qrcode>|<tp_amb>[|...campos de
contingência]`; a chave de acesso (44 dígitos) é sempre o primeiro campo, e é dela
que extraímos cUF (escolhe o adaptador de UF), CNPJ do emitente e o modelo do
documento (65 = NFC-e; 55 = NF-e, rejeitado aqui).
"""

import re
from dataclasses import dataclass
from typing import Final
from urllib.parse import unquote, urlparse

from api.core.exceptions import BadRequestError

ACCESS_KEY_LENGTH: Final = 44
NFCE_MODEL: Final = "65"
NFE_MODEL: Final = "55"
SUPPORTED_QR_VERSIONS: Final = (2, 3)
MIN_QR_FIELDS: Final = 3  # chave|versao|tpAmb — contingência offline soma campos extras

# Host antigo desativado em 30/08/2025 (Informe Técnico 2025.003) — cupons antigos
# continuam com esse host no QR; reescrevemos para o novo antes de qualquer fetch.
GO_OLD_HOST: Final = "nfe.sefaz.go.gov.br"
GO_NEW_HOST: Final = "nfeweb.sefaz.go.gov.br"

_DIGITS_ONLY: Final = re.compile(r"^\d+$")

# cUF (IBGE) -> sigla da UF. Tabela padrão do IBGE; só GO tem adaptador nesta onda
# (docs/nfce-sefaz-go.md > Próximos estados) — as demais entram por demanda.
IBGE_UF_CODES: Final[dict[str, str]] = {
    "11": "RO",
    "12": "AC",
    "13": "AM",
    "14": "RR",
    "15": "PA",
    "16": "AP",
    "17": "TO",
    "21": "MA",
    "22": "PI",
    "23": "CE",
    "24": "RN",
    "25": "PB",
    "26": "PE",
    "27": "AL",
    "28": "SE",
    "29": "BA",
    "31": "MG",
    "32": "ES",
    "33": "RJ",
    "35": "SP",
    "41": "PR",
    "42": "SC",
    "43": "RS",
    "50": "MS",
    "51": "MT",
    "52": "GO",
    "53": "DF",
}


class InvalidNfceQrError(BadRequestError):
    TITLE = "QR Code de NFC-e inválido"
    DETAIL = "Não foi possível ler o QR Code da nota fiscal."


@dataclass(frozen=True, slots=True)
class AccessKey:
    """Os 44 dígitos da chave de acesso, já decompostos (docs/nfce-sefaz-go.md)."""

    raw: str
    ibge_uf_code: str
    emission_year_month: str
    cnpj: str
    model: str
    series: str
    number: str
    emission_type: str
    numeric_code: str
    check_digit: str

    @property
    def state_code(self) -> str | None:
        """Sigla da UF (ex.: 'GO') ou `None` se o código IBGE não for reconhecido."""
        return IBGE_UF_CODES.get(self.ibge_uf_code)


@dataclass(frozen=True, slots=True)
class QrPayload:
    """Resultado do parse do parâmetro `p` do QR — v2 ou v3, URL ou só o `p=`."""

    access_key: AccessKey
    qr_version: int
    tp_amb: str
    qr_url: str | None
    extra_fields: tuple[str, ...]


def _mod11_check_digit(digits: str) -> int:
    """Dígito verificador padrão da chave de acesso NF-e/NFC-e (peso 2-9 cíclico, da direita)."""
    weights = (2, 3, 4, 5, 6, 7, 8, 9)
    total = sum(int(digit) * weights[i % len(weights)] for i, digit in enumerate(reversed(digits)))
    remainder = total % 11
    return 0 if remainder in (0, 1) else 11 - remainder


def parse_access_key(key: str) -> AccessKey:
    """Valida tamanho, dígitos, modelo (65 = NFC-e) e DV (módulo 11).

    Levanta `InvalidNfceQrError` (400, pt-BR) em qualquer inconsistência.
    """
    candidate = key.strip()
    if len(candidate) != ACCESS_KEY_LENGTH or not _DIGITS_ONLY.match(candidate):
        raise InvalidNfceQrError(
            detail=(
                f"Chave de acesso precisa ter {ACCESS_KEY_LENGTH} dígitos numéricos "
                f"(recebido: {key!r})."
            )
        )
    model = candidate[20:22]
    if model == NFE_MODEL:
        raise InvalidNfceQrError(detail="Este QR Code é de uma NF-e (modelo 55), não de NFC-e.")
    if model != NFCE_MODEL:
        raise InvalidNfceQrError(detail=f"Modelo de documento não suportado: {model!r}.")
    expected_dv = _mod11_check_digit(candidate[:43])
    if str(expected_dv) != candidate[43]:
        raise InvalidNfceQrError(
            detail=f"Dígito verificador inválido na chave de acesso {candidate!r}."
        )
    return AccessKey(
        raw=candidate,
        ibge_uf_code=candidate[0:2],
        emission_year_month=candidate[2:6],
        cnpj=candidate[6:20],
        model=model,
        series=candidate[22:25],
        number=candidate[25:34],
        emission_type=candidate[34:35],
        numeric_code=candidate[35:43],
        check_digit=candidate[43:44],
    )


def rewrite_old_go_host(url: str) -> str:
    """Host antigo de GO (`nfe.sefaz.go.gov.br`) → novo (`nfeweb.sefaz.go.gov.br`)."""
    return url.replace(GO_OLD_HOST, GO_NEW_HOST) if GO_OLD_HOST in url else url


def _extract_p_value(raw_qr_text: str) -> tuple[str, str | None]:
    """Devolve `(valor_de_p, url_normalizada_ou_none)`."""
    text = raw_qr_text.strip()
    if text.lower().startswith(("http://", "https://")):
        normalized_url = rewrite_old_go_host(text)
        query = urlparse(normalized_url).query
        params = dict(pair.split("=", 1) for pair in query.split("&") if "=" in pair)
        if "p" not in params:
            raise InvalidNfceQrError(detail=f"URL do QR Code sem parâmetro 'p': {raw_qr_text!r}")
        return unquote(params["p"]), normalized_url
    if text.startswith("p="):
        return unquote(text[2:]), None
    return unquote(text), None


def parse_qr(raw_qr_text: str) -> QrPayload:
    """Parse do texto lido do QR — aceita URL completa (host novo ou antigo), `p=...` ou só o valor.

    Levanta `InvalidNfceQrError` (400, pt-BR) em qualquer formato inesperado.
    """
    if not raw_qr_text or not raw_qr_text.strip():
        raise InvalidNfceQrError(detail="QR Code vazio.")
    p_value, qr_url = _extract_p_value(raw_qr_text)
    parts = p_value.split("|")
    if len(parts) < MIN_QR_FIELDS:
        raise InvalidNfceQrError(
            detail=(
                "QR Code malformado: esperado ao menos 3 campos "
                f"'chave|versao|tpAmb', recebido {p_value!r}."
            )
        )
    access_key = parse_access_key(parts[0])
    try:
        qr_version = int(parts[1])
    except ValueError as exc:
        raise InvalidNfceQrError(detail=f"Versão do QR Code inválida: {parts[1]!r}.") from exc
    if qr_version not in SUPPORTED_QR_VERSIONS:
        raise InvalidNfceQrError(detail=f"Versão do QR Code não suportada: {qr_version}.")
    return QrPayload(
        access_key=access_key,
        qr_version=qr_version,
        tp_amb=parts[2],
        qr_url=qr_url,
        extra_fields=tuple(parts[3:]),
    )
