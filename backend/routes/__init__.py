from .health import router as health_router
from .vendors import router as vendors_router
from .checkins import router as checkins_router
from .demand import router as demand_router
from .spots import router as spots_router
from .recommendations import router as recommendations_router

__all__ = [
    "health_router",
    "vendors_router",
    "checkins_router",
    "demand_router",
    "spots_router",
    "recommendations_router",
]
