from fastapi import APIRouter

from api.routes.catalog.category import router as category_router
from api.routes.catalog.product import router as product_router
from api.routes.geo.city import router as city_router
from api.routes.health import router as health_router
from api.routes.markets.market import router as market_router
from api.routes.prices.price import router as price_router
from config.api import api_config

api_router = APIRouter(prefix=api_config.API_PREFIX)
api_router.include_router(health_router)
api_router.include_router(city_router)
api_router.include_router(category_router)
api_router.include_router(product_router)
api_router.include_router(market_router)
api_router.include_router(price_router)
