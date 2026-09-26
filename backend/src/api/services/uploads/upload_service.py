"""`save_upload` — boundary única de IO de upload (skill `uploads-storage`).

`mode="image"` decodifica qualquer formato suportado (OpenCV, skill
`image-processing`), redimensiona sem upscale e reencoda em AVIF; `mode="raw"`
grava os bytes como vieram (reservado para uso futuro — HTML/XML de NFC-e).
"""

import functools
import re
import unicodedata
import uuid
from dataclasses import dataclass
from typing import Final

import anyio
import cv2
import numpy as np
from fastapi import UploadFile

from api.core.exceptions import BadRequestError
from api.services.uploads.storage import storage

SLUG_MAX_LENGTH: Final = 60
AVIF_QUALITY: Final = 80
DEFAULT_IMAGE_MAX_DIMENSION: Final = 1600
DEFAULT_IMAGE_MAX_BYTES: Final = 8 * 1024 * 1024
ALLOWED_IMAGE_MIME: Final = {"image/jpeg", "image/png", "image/webp"}


@dataclass(frozen=True, slots=True)
class UploadResult:
    url: str
    storage_key: str
    filename: str
    mime_type: str
    size_bytes: int
    width: int | None
    height: int | None


def _slugify(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")
    return (slug or "arquivo")[:SLUG_MAX_LENGTH]


def _build_filename(name_seed: str, ext: str) -> str:
    return f"{_slugify(name_seed)}-{uuid.uuid4()}.{ext}"


def _ext_from_name(name: str | None, mime: str | None) -> str:
    if name and "." in name:
        return name.rsplit(".", 1)[-1].lower()
    if mime:
        return mime.split("/")[-1].split("+")[0].lower()
    return "bin"


def _decode_resize_encode_avif(raw: bytes, *, max_dimension: int) -> tuple[bytes, int, int]:
    """CPU-bound (OpenCV) — sempre chamada via `anyio.to_thread.run_sync`."""
    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise BadRequestError(
            detail="Não foi possível ler a imagem enviada — arquivo corrompido ou formato não suportado."
        )
    height, width = image.shape[:2]
    if max(height, width) > max_dimension:
        scale = max_dimension / max(height, width)
        image = cv2.resize(
            image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA
        )
        height, width = image.shape[:2]
    ok, buffer = cv2.imencode(".avif", image, [cv2.IMWRITE_AVIF_QUALITY, AVIF_QUALITY])
    if not ok:
        raise BadRequestError(detail="Falha ao converter a imagem para AVIF.")
    return buffer.tobytes(), width, height


def _validate_size(raw: bytes, max_bytes: int) -> None:
    if not raw:
        raise BadRequestError(detail="Arquivo vazio.")
    if len(raw) > max_bytes:
        raise BadRequestError(
            detail=f"Arquivo muito grande: {len(raw)} bytes, máximo permitido {max_bytes} bytes."
        )


async def save_upload(
    file: UploadFile,
    *path_parts: str,
    mode: str,
    base_name: str | None = None,
    fixed_name: str | None = None,
    allowed_mime: set[str] | None = None,
    max_bytes: int = DEFAULT_IMAGE_MAX_BYTES,
    image_max_dimension: int = DEFAULT_IMAGE_MAX_DIMENSION,
    public: bool = False,
) -> UploadResult:
    if mode not in {"image", "raw"}:
        raise BadRequestError(
            detail=f"modo de upload inválido: {mode!r}, esperado 'image' ou 'raw'"
        )

    raw = await file.read()
    _validate_size(raw, max_bytes)

    mime_whitelist = allowed_mime or ALLOWED_IMAGE_MIME
    if mode == "image" and file.content_type not in mime_whitelist:
        raise BadRequestError(
            detail=f"Tipo de arquivo não suportado: {file.content_type!r}. "
            f"Aceitos: {sorted(mime_whitelist)}."
        )

    name_seed = fixed_name or base_name or file.filename or "arquivo"

    if mode == "image":
        content, width, height = await anyio.to_thread.run_sync(
            functools.partial(_decode_resize_encode_avif, raw, max_dimension=image_max_dimension)
        )
        ext, mime_type = "avif", "image/avif"
    else:
        content, width, height = raw, None, None
        ext = _ext_from_name(file.filename, file.content_type)
        mime_type = file.content_type or "application/octet-stream"

    filename = _build_filename(name_seed, ext)
    key = "/".join([*path_parts, filename])
    result = await storage.save_bytes(key, content, mime_type, public=public)

    return UploadResult(
        url=result.url,
        storage_key=key,
        filename=filename,
        mime_type=mime_type,
        size_bytes=len(content),
        width=width,
        height=height,
    )
