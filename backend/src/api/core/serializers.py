from typing import Any

import orjson
from fastapi import Response


class CustomORJSONResponse(Response):
    """`default_response_class` do FastAPI — orjson em vez do `json` stdlib."""

    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        return orjson.dumps(
            content,
            option=orjson.OPT_NAIVE_UTC,
        )
