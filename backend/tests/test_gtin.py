import pytest

from api.core.exceptions import BadRequestError
from api.services.catalog.gtin import normalize_gtin


def test_valid_ean13_stays_thirteen_digits():
    assert normalize_gtin("4006381333931") == "4006381333931"


def test_valid_upc_a_normalizes_to_thirteen_digits():
    assert normalize_gtin("012345678905") == "0012345678905"


def test_valid_ean8_normalizes_to_thirteen_digits():
    assert normalize_gtin("12345670") == "0000012345670"


def test_strips_surrounding_whitespace():
    assert normalize_gtin("  4006381333931  ") == "4006381333931"


def test_wrong_check_digit_is_rejected():
    with pytest.raises(BadRequestError):
        normalize_gtin("12345671")


def test_non_digit_characters_are_rejected():
    with pytest.raises(BadRequestError):
        normalize_gtin("1234567a")


def test_invalid_length_is_rejected():
    with pytest.raises(BadRequestError):
        normalize_gtin("12345")
