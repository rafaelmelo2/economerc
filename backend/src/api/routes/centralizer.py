from fastapi import APIRouter

from api.routes.account import router as account_router
from api.routes.catalog.category import router as category_router
from api.routes.catalog.product import router as product_router
from api.routes.collectors.offer_candidates_admin import router as offer_candidates_admin_router
from api.routes.collectors.supercatalao_admin import router as supercatalao_admin_router
from api.routes.collectors.whatsapp_webhook import router as whatsapp_webhook_router
from api.routes.geo.city import router as city_router
from api.routes.health import router as health_router
from api.routes.markets.market import router as market_router
from api.routes.prices.price import router as price_router
from api.routes.sync.pull import router as sync_pull_router
from api.routes.sync.push import router as sync_push_router
from config.api import api_config

api_router = APIRouter(prefix=api_config.API_PREFIX)
api_router.include_router(health_router)
api_router.include_router(city_router)
api_router.include_router(category_router)
api_router.include_router(account_router)
api_router.include_router(sync_push_router)
api_router.include_router(sync_pull_router)
api_router.include_router(product_router)
api_router.include_router(market_router)
api_router.include_router(price_router)
api_router.include_router(supercatalao_admin_router)
api_router.include_router(offer_candidates_admin_router)
api_router.include_router(whatsapp_webhook_router)
