"""Compressão do HTML bruto da NFC-e para caber em `receipts.raw_html` (`TEXT`).

Sem sistema de uploads nesta fase (docs/roadmap-fase1.md > Etapa 7) — o bruto fica no próprio
Postgres. `zlib` + base64 porque a coluna é `TEXT`, não `BYTEA` (mais simples de inspecionar/
exportar via `psql`/dbmate sem lidar com encoding binário).
"""

import base64
import zlib
from typing import Final

_COMPRESSION_LEVEL: Final = 9


def compress_raw_html(html: str) -> str:
    compressed = zlib.compress(html.encode("utf-8"), level=_COMPRESSION_LEVEL)
    return base64.b64encode(compressed).decode("ascii")


def decompress_raw_html(blob: str) -> str:
    compressed = base64.b64decode(blob.encode("ascii"))
    return zlib.decompress(compressed).decode("utf-8")
