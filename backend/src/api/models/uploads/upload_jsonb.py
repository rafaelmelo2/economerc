"""Enums de `user_uploads` — sem tabela própria (`_jsonb.py`, skill `database`)."""

from enum import StrEnum


class UploadKind(StrEnum):
    PRICE_TAG_PHOTO = "price_tag_photo"


class UploadVisibility(StrEnum):
    PUBLIC = "public"
    TENANT = "tenant"
    PRIVATE = "private"
