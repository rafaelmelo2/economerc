from fastapi import APIRouter

from api.routes.catalog.category import router as category_router
from api.routes.geo.city import router as city_router
from api.routes.health import router as health_router
from api.routes.sync.pull import router as sync_pull_router
from api.routes.sync.push import router as sync_push_router
from config.api import api_config

api_router = APIRouter(prefix=api_config.API_PREFIX)
api_router.include_router(health_router)
api_router.include_router(city_router)
api_router.include_router(category_router)
api_router.include_router(sync_push_router)
api_router.include_router(sync_pull_router)
