"""Testes puros do parser de QR da NFC-e (sem banco) — chaves calculadas com o mesmo
algoritmo mod11 da chave de acesso (docs/nfce-sefaz-go.md)."""

import pytest

from api.services.nfce.qr import InvalidNfceQrError, parse_access_key, parse_qr, rewrite_old_go_host

# GO (cUF=52), modelo 65 (NFC-e), DV válido.
VALID_GO_KEY = "52250911222333000181650010001234561123456786"
# Mesmo corpo, modelo 55 (NF-e) — tem que ser rejeitado.
NFE_MODEL_KEY = "52250911222333000181550010001234561123456783"
# cUF=99 (não existe na tabela IBGE) — chave bem formada, UF não reconhecida.
UNKNOWN_UF_KEY = "99250911222333000181650010001234561123456782"

VALID_QR_URL = f"https://nfeweb.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p={VALID_GO_KEY}|3|1"
OLD_HOST_QR_URL = f"http://nfe.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p={VALID_GO_KEY}|3|1"


def test_parse_access_key_extracts_all_fields():
    key = parse_access_key(VALID_GO_KEY)
    assert key.ibge_uf_code == "52"
    assert key.state_code == "GO"
    assert key.cnpj == "11222333000181"
    assert key.model == "65"
    assert key.raw == VALID_GO_KEY


def test_parse_access_key_rejects_wrong_check_digit():
    tampered = VALID_GO_KEY[:-1] + str((int(VALID_GO_KEY[-1]) + 1) % 10)
    with pytest.raises(InvalidNfceQrError):
        parse_access_key(tampered)


def test_parse_access_key_rejects_wrong_length():
    with pytest.raises(InvalidNfceQrError):
        parse_access_key("12345")


def test_parse_access_key_rejects_non_digits():
    with pytest.raises(InvalidNfceQrError):
        parse_access_key("a" * 43 + "1")


def test_parse_access_key_rejects_nfe_model_55():
    with pytest.raises(InvalidNfceQrError) as exc_info:
        parse_access_key(NFE_MODEL_KEY)
    assert "modelo 55" in exc_info.value.detail


def test_parse_access_key_unknown_uf_has_no_state_code():
    key = parse_access_key(UNKNOWN_UF_KEY)
    assert key.state_code is None


def test_parse_qr_v3_full_url():
    payload = parse_qr(VALID_QR_URL)
    assert payload.qr_version == 3
    assert payload.tp_amb == "1"
    assert payload.access_key.raw == VALID_GO_KEY
    assert payload.qr_url == VALID_QR_URL


def test_parse_qr_rewrites_old_go_host():
    payload = parse_qr(OLD_HOST_QR_URL)
    assert payload.qr_url is not None
    assert "nfeweb.sefaz.go.gov.br" in payload.qr_url
    assert "nfe.sefaz.go.gov.br" not in payload.qr_url


def test_parse_qr_bare_p_param():
    payload = parse_qr(f"p={VALID_GO_KEY}|3|1")
    assert payload.qr_url is None
    assert payload.access_key.raw == VALID_GO_KEY


def test_parse_qr_raw_pipe_string_without_prefix():
    payload = parse_qr(f"{VALID_GO_KEY}|3|1")
    assert payload.qr_version == 3
    assert payload.access_key.raw == VALID_GO_KEY


def test_parse_qr_v2_legacy_format_with_hash():
    """v2 tem um 4º campo (hash do CSC) — o parser aceita e devolve em `extra_fields`."""
    payload = parse_qr(f"{VALID_GO_KEY}|2|1|deadbeefcafe")
    assert payload.qr_version == 2
    assert payload.extra_fields == ("deadbeefcafe",)


def test_parse_qr_contingency_v3_extra_fields_preserved():
    payload = parse_qr(f"{VALID_GO_KEY}|3|1|15092026|123.45|1|assinaturaXYZ")
    assert payload.qr_version == 3
    assert payload.extra_fields == ("15092026", "123.45", "1", "assinaturaXYZ")


def test_parse_qr_rejects_unsupported_version():
    with pytest.raises(InvalidNfceQrError):
        parse_qr(f"{VALID_GO_KEY}|4|1")


def test_parse_qr_rejects_nfe_model_55():
    with pytest.raises(InvalidNfceQrError):
        parse_qr(f"{NFE_MODEL_KEY}|3|1")


def test_parse_qr_rejects_empty_text():
    with pytest.raises(InvalidNfceQrError):
        parse_qr("   ")


def test_parse_qr_rejects_too_few_fields():
    with pytest.raises(InvalidNfceQrError):
        parse_qr(VALID_GO_KEY)


def test_rewrite_old_go_host_is_a_noop_for_new_host():
    assert rewrite_old_go_host(VALID_QR_URL) == VALID_QR_URL
