from fastapi import APIRouter

try:
    from backend.db import ping_database
    from backend.models.response import success_response
except ImportError:
    from db import ping_database
    from models.response import success_response

router = APIRouter(tags=["Health & Status"])


@router.get(
    "/",
    summary="Root Endpoint",
    description="Returns service availability message."
)
async def root():
    """
    Root endpoint confirming backend is up and running.
    """
    return {
        "message": "Vyapar Backend is running"
    }


@router.get(
    "/health",
    summary="Health Check Endpoint",
    description="Returns backend service and database health status wrapped in standard envelope."
)
async def health_check():
    """
    System health check reporting application and MongoDB connectivity state.
    """
    db_health = ping_database()
    
    health_data = {
        "status": "healthy",
        "service": "Vyapar API",
        "version": "1.0.0",
        "database": db_health
    }
    
    return success_response(data=health_data)
