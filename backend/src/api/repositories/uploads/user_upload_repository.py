"""Repositório de `user_uploads` (skill `database`). Sem soft-delete de negócio —
`deleted_at` existe por convenção, mas o bloco 4B nunca deleta foto de etiqueta."""

from dataclasses import dataclass, field
from uuid import UUID

from asyncpg import Connection


@dataclass(frozen=True, slots=True)
class NewUserUpload:
    """Input de CREATE — completo (id/timestamps ficam por conta do DB)."""

    owner_user_id: UUID
    kind: str
    url: str
    storage_key: str | None
    filename: str
    mime_type: str | None
    size_bytes: int
    width: int | None = None
    height: int | None = None
    visibility: str = "private"
    entity_type: str | None = None
    entity_id: str | None = None
    metadata: dict = field(default_factory=dict)


class UserUploadRepository:
    async def create(self, conn: Connection, upload: NewUserUpload) -> dict:
        row = await conn.fetchrow(
            """
            INSERT INTO user_uploads (owner_user_id, kind, entity_type, entity_id, url,
                                       storage_key, filename, mime_type, size_bytes, width,
                                       height, visibility, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *
            """,
            upload.owner_user_id,
            upload.kind,
            upload.entity_type,
            upload.entity_id,
            upload.url,
            upload.storage_key,
            upload.filename,
            upload.mime_type,
            upload.size_bytes,
            upload.width,
            upload.height,
            upload.visibility,
            upload.metadata,
        )
        return dict(row)

    async def get_by_id(self, conn: Connection, upload_id: UUID) -> dict | None:
        row = await conn.fetchrow(
            "SELECT * FROM user_uploads WHERE id = $1 AND deleted_at IS NULL", upload_id
        )
        return dict(row) if row else None


user_upload_repository = UserUploadRepository()
