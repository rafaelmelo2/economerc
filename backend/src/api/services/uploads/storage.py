"""`StorageBackend` — costura única de IO de bytes (skill `uploads-storage`).

Fase 1 só tem `LocalStorageBackend` (NVMe, `backend/uploads/`). Migrar para
object storage (B2/S3) é implementar o Protocol e trocar `storage` no fim
deste módulo — `upload_service.save_upload` nunca muda.
"""

import shutil
from dataclasses import dataclass
from typing import Protocol

import anyio

from config.uploads import uploads_dir


@dataclass(frozen=True, slots=True)
class SaveResult:
    url: str
    etag: str | None = None
    version_id: str | None = None


class StorageBackend(Protocol):
    is_remote: bool

    async def save_bytes(
        self, key: str, content: bytes, mime: str | None, *, public: bool
    ) -> SaveResult: ...

    async def delete_file(self, key: str, *, public: bool) -> bool: ...

    async def delete_tree(self, prefix: str) -> bool: ...

    def build_url(self, key: str, *, public: bool) -> str: ...

    async def presigned_url(self, key: str, ttl_seconds: int = 600) -> str: ...

    def key_from_url(self, url: str) -> str | None: ...


class LocalStorageBackend:
    """Grava em `uploads_dir()`. `is_remote=False` → serving é `FileResponse` direta."""

    is_remote = False

    async def save_bytes(
        self,
        key: str,
        content: bytes,
        mime: str | None,  # noqa: ARG002 — parte do Protocol; object storage usa pra Content-Type
        *,
        public: bool,  # noqa: ARG002 — parte do Protocol; local ignora (sem bucket público/privado)
    ) -> SaveResult:
        path = uploads_dir() / key
        await anyio.Path(path.parent).mkdir(parents=True, exist_ok=True)
        await anyio.Path(path).write_bytes(content)
        return SaveResult(url=key)

    async def delete_file(self, key: str, *, public: bool) -> bool:  # noqa: ARG002
        path = anyio.Path(uploads_dir() / key)
        if not await path.exists():
            return False
        await path.unlink()
        return True

    async def delete_tree(self, prefix: str) -> bool:
        path = uploads_dir() / prefix
        if not await anyio.Path(path).exists():
            return False
        await anyio.to_thread.run_sync(shutil.rmtree, str(path))
        return True

    def build_url(self, key: str, *, public: bool) -> str:  # noqa: ARG002
        return key

    async def presigned_url(self, key: str, ttl_seconds: int = 600) -> str:  # noqa: ARG002
        return key

    def key_from_url(self, url: str) -> str | None:
        return url


storage: StorageBackend = LocalStorageBackend()
