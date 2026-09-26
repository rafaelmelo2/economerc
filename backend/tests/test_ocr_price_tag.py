"""`POST /api/ocr/price-tag` — IA sempre mockada (tests.md), nada de rede real."""

import os
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import orjson
import pytest
from asyncpg import Connection
from httpx import AsyncClient

from api.core.valkey_client import get_valkey
from api.main import app
from api.repositories.uploads.user_upload_repository import user_upload_repository
from api.services.ai import ai_client


class _FakeValkey:
    """Stub mínimo de Valkey (get/set) — lifespan não roda sob `ASGITransport`."""

    def __init__(self):
        self._store: dict[str, bytes] = {}

    async def get(self, key: str) -> bytes | None:
        return self._store.get(key)

    async def set(self, key: str, value: bytes, ex: int | None = None) -> None:
        self._store[key] = value


@pytest.fixture(autouse=True)
def _fake_valkey():
    fake = _FakeValkey()
    app.dependency_overrides[get_valkey] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_valkey, None)


@dataclass
class _FakeCompletion:
    content: str


def _fake_jpeg_bytes(width: int = 40, height: int = 30) -> bytes:
    image = np.zeros((height, width, 3), dtype=np.uint8)
    image[:] = (30, 60, 200)
    ok, buffer = cv2.imencode(".jpg", image)
    assert ok
    return buffer.tobytes()


_VALID_READING = {
    "product_name": "Arroz Tipo 1 5kg",
    "price": "24.90",
    "unit": "un",
    "price_per_unit": None,
    "is_promo": False,
    "promo_price": None,
    "confidence": 0.92,
}


def _install_ai_response(monkeypatch: pytest.MonkeyPatch, content: str, *, calls: list):
    async def fake_complete(task: str, **kwargs):
        calls.append(task)
        return _FakeCompletion(content=content)

    monkeypatch.setattr(ai_client, "complete", fake_complete)


async def test_read_price_tag_requires_auth(client: AsyncClient):
    res = await client.post(
        "/api/ocr/price-tag", files={"file": ("etiqueta.jpg", _fake_jpeg_bytes(), "image/jpeg")}
    )
    assert res.status_code == 401


async def test_read_price_tag_valid_ai_response_returns_reading(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, bearer
):
    calls: list[str] = []
    _install_ai_response(monkeypatch, orjson.dumps(_VALID_READING).decode(), calls=calls)

    res = await client.post(
        "/api/ocr/price-tag",
        files={"file": ("etiqueta.jpg", _fake_jpeg_bytes(), "image/jpeg")},
        data={"ean": "7891000100103"},
        headers=await bearer(),
    )

    assert res.status_code == 201
    body = res.json()
    assert body["product_name"] == "Arroz Tipo 1 5kg"
    assert body["price"] == "24.90"
    assert body["unit"] == "un"
    assert body["confidence"] == pytest.approx(0.92)
    assert body["cached"] is False
    assert body["upload_id"]
    assert calls == ["price_tag_ocr"]


async def test_read_price_tag_invalid_json_returns_treated_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, bearer
):
    calls: list[str] = []
    _install_ai_response(monkeypatch, "isto não é JSON", calls=calls)

    res = await client.post(
        "/api/ocr/price-tag",
        files={"file": ("etiqueta.jpg", _fake_jpeg_bytes(), "image/jpeg")},
        headers=await bearer(),
    )

    assert res.status_code == 502
    body = res.json()
    assert "leitura da etiqueta" in body["detail"]


async def test_read_price_tag_missing_required_field_returns_treated_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, bearer
):
    calls: list[str] = []
    broken_reading = dict(_VALID_READING)
    broken_reading.pop("price")
    _install_ai_response(monkeypatch, orjson.dumps(broken_reading).decode(), calls=calls)

    res = await client.post(
        "/api/ocr/price-tag",
        files={"file": ("etiqueta.jpg", _fake_jpeg_bytes(), "image/jpeg")},
        headers=await bearer(),
    )

    assert res.status_code == 502


async def test_read_price_tag_rejects_file_too_large(client: AsyncClient, bearer):
    huge_payload = b"\xff" * (8 * 1024 * 1024 + 1)
    res = await client.post(
        "/api/ocr/price-tag",
        files={"file": ("etiqueta.jpg", huge_payload, "image/jpeg")},
        headers=await bearer(),
    )
    assert res.status_code == 400


async def test_read_price_tag_rejects_invalid_mime(client: AsyncClient, bearer):
    res = await client.post(
        "/api/ocr/price-tag",
        files={"file": ("etiqueta.txt", b"nao e imagem", "text/plain")},
        headers=await bearer(),
    )
    assert res.status_code == 400


async def test_read_price_tag_same_photo_hits_cache_and_skips_second_ai_call(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, bearer
):
    calls: list[str] = []
    _install_ai_response(monkeypatch, orjson.dumps(_VALID_READING).decode(), calls=calls)
    headers = await bearer()
    photo = _fake_jpeg_bytes()

    first = await client.post(
        "/api/ocr/price-tag", files={"file": ("etiqueta.jpg", photo, "image/jpeg")}, headers=headers
    )
    second = await client.post(
        "/api/ocr/price-tag", files={"file": ("etiqueta.jpg", photo, "image/jpeg")}, headers=headers
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["cached"] is False
    assert second.json()["cached"] is True
    assert calls == ["price_tag_ocr"]  # segunda chamada usou o cache por hash da imagem


async def test_read_price_tag_saves_photo_as_avif_on_disk(
    client: AsyncClient, db_conn: Connection, monkeypatch: pytest.MonkeyPatch, bearer
):
    calls: list[str] = []
    _install_ai_response(monkeypatch, orjson.dumps(_VALID_READING).decode(), calls=calls)

    res = await client.post(
        "/api/ocr/price-tag",
        files={"file": ("etiqueta.jpg", _fake_jpeg_bytes(), "image/jpeg")},
        headers=await bearer(),
    )
    assert res.status_code == 201
    upload_id = res.json()["upload_id"]

    upload_row = await user_upload_repository.get_by_id(db_conn, upload_id)
    assert upload_row is not None
    assert upload_row["filename"].endswith(".avif")
    assert upload_row["mime_type"] == "image/avif"
    assert upload_row["visibility"] == "private"

    saved_path = Path(os.environ["UPLOADS_DIR"]) / upload_row["storage_key"]
    assert saved_path.is_file()
    assert saved_path.read_bytes()[4:12] in (b"ftypavif", b"ftypavis")
