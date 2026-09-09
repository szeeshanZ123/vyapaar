import logging
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Ensure root and backend directories are in sys.path
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
for p in [str(ROOT_DIR), str(BASE_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.db import init_db_indexes, ping_database, close_db_connection
    from backend.models.response import error_response
    from backend.routes.health import router as health_router
    from backend.routes.users import router as users_router
    from backend.routes.vendors import router as vendors_router
    from backend.routes.checkins import router as checkins_router
    from backend.routes.demand import router as demand_router
    from backend.routes.spots import router as spots_router
    from backend.routes.recommendations import router as recommendations_router
    from backend.routes.alerts import router as alerts_router
except ImportError:
    from db import init_db_indexes, ping_database, close_db_connection
    from models.response import error_response
    from routes.health import router as health_router
    from routes.users import router as users_router
    from routes.vendors import router as vendors_router
    from routes.checkins import router as checkins_router
    from routes.demand import router as demand_router
    from routes.spots import router as spots_router
    from routes.recommendations import router as recommendations_router
    from routes.alerts import router as alerts_router

# Configure basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("vyapar.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager handling startup and shutdown procedures.
    """
    logger.info("Starting up Vyapar Backend...")
    
    # Check database connectivity and initialize indexes
    db_status = ping_database()
    if db_status.get("status") == "connected":
        logger.info("MongoDB connected successfully. Initializing collections & indexes...")
        index_status = init_db_indexes()
        logger.info(f"Index initialization status: {index_status.get('status')}")
    else:
        logger.warning(
            "MongoDB is not currently reachable. "
            "The backend will continue running, and will connect once MongoDB is available."
        )

    yield

    logger.info("Shutting down Vyapar Backend...")
    close_db_connection()


# Initialize FastAPI Application
app = FastAPI(
    title="Vyapar API",
    description="Backend for Vyapar — a location-intelligence platform for street vendors.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS for development & hackathon environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler returning standardized JSON response
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response(
            message="An internal server error occurred",
            details=str(exc)
        )
    )

# Include Route Handlers
app.include_router(health_router)
app.include_router(users_router)
app.include_router(vendors_router)
app.include_router(checkins_router)
app.include_router(demand_router)
app.include_router(spots_router)
app.include_router(recommendations_router)
app.include_router(alerts_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

