from typing import Annotated, Final, Literal

from fastapi import Depends, Query

from api.repositories.shared.listing import ListParams

DEFAULT_PAGE_LIMIT: Final = 10
MAX_PAGE_LIMIT: Final = 200
MIN_SEARCH_LENGTH: Final = 3
MAX_SEARCH_LENGTH: Final = 120


async def get_list_params(
    skip: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    search: str | None = Query(None, max_length=MAX_SEARCH_LENGTH),
    sort: str | None = Query(None, max_length=40),
    order: Literal["asc", "desc"] | None = Query(None),
) -> ListParams:
    term = (search or "").strip()
    return ListParams(
        skip=skip,
        limit=limit,
        search=term if len(term) >= MIN_SEARCH_LENGTH else None,
        sort=sort,
        order=order,
    )


ListParamsDep = Annotated[ListParams, Depends(get_list_params)]
