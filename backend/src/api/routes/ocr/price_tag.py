"""`POST /api/ocr/price-tag` (docs/roadmap-fase1.md > Etapa 6). Salva a foto da
etiqueta (`user_uploads`, visibility privada) e devolve a leitura estruturada
da IA — o app confirma antes de virar preço; esta rota nunca grava em `prices`.
"""

import hashlib
from typing import Final
from uuid import UUID

from asyncpg import Connection
from fastapi import APIRouter, Depends, File, Form, UploadFile
from valkey.asyncio import Valkey

from api.core.exceptions import BadRequestError
from api.core.valkey_client import get_valkey
from api.dependencies.auth import CurrentUser
from api.models.uploads.upload_jsonb import UploadKind, UploadVisibility
from api.repositories.uploads.user_upload_repository import NewUserUpload, user_upload_repository
from api.schemas.ocr.price_tag import PriceTagOcrResponse
from api.services.ocr.price_tag_ocr_service import read_price_tag_photo
from api.services.uploads.upload_service import save_upload
from config.database import get_conn
from config.uploads import PRICE_TAG_PHOTOS, user_dir

router = APIRouter(prefix="/ocr", tags=["OCR"])

PRICE_TAG_PHOTO_MAX_BYTES: Final = 8 * 1024 * 1024


@router.post("/price-tag", response_model=PriceTagOcrResponse, status_code=201)
async def read_price_tag(
    user: CurrentUser,
    file: UploadFile = File(...),
    ean: str | None = Form(default=None),
    market_id: UUID | None = Form(default=None),
    conn: Connection = Depends(get_conn),
    valkey: Valkey = Depends(get_valkey),
) -> PriceTagOcrResponse:
    raw = await file.read()
    if not raw:
        raise BadRequestError(detail="Envie a foto da etiqueta.")
    if len(raw) > PRICE_TAG_PHOTO_MAX_BYTES:
        raise BadRequestError(
            detail=f"Foto muito grande: máximo {PRICE_TAG_PHOTO_MAX_BYTES} bytes."
        )
    image_hash = hashlib.sha256(raw).hexdigest()
    await file.seek(0)

    upload_result = await save_upload(
        file,
        *user_dir(user.user_id),
        PRICE_TAG_PHOTOS,
        mode="image",
        base_name=ean or "etiqueta",
        max_bytes=PRICE_TAG_PHOTO_MAX_BYTES,
        public=False,
    )
    upload_row = await user_upload_repository.create(
        conn,
        NewUserUpload(
            owner_user_id=user.user_id,
            kind=UploadKind.PRICE_TAG_PHOTO,
            url=upload_result.url,
            storage_key=upload_result.storage_key,
            filename=upload_result.filename,
            mime_type=upload_result.mime_type,
            size_bytes=upload_result.size_bytes,
            width=upload_result.width,
            height=upload_result.height,
            visibility=UploadVisibility.PRIVATE,
            entity_type="ocr_price_tag",
            entity_id=str(market_id) if market_id else None,
            metadata={"ean": ean} if ean else {},
        ),
    )

    reading, cached = await read_price_tag_photo(valkey, raw, image_hash=image_hash)

    return PriceTagOcrResponse(upload_id=upload_row["id"], cached=cached, **reading.model_dump())
