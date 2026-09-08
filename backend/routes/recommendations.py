from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from pymongo.database import Database

try:
    from backend.db import get_database
    from backend.models.response import success_response
    from backend.models.vendor import VendorCategory
    from backend.engines.recommendation import get_recommendations
except ImportError:
    from db import get_database
    from models.response import success_response
    from models.vendor import VendorCategory
    from engines.recommendation import get_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["Smart Recommendations"])


@router.get(
    "",
    summary="Get Smart Spot Recommendations",
    description="Ranks nearby spots based on demand footfall, distance penalty, category relevance, shelter, and transit access."
)
async def get_spot_recommendations(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Current latitude between -90.0 and 90.0"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Current longitude between -180.0 and 180.0"),
    category: Optional[str] = Query(None, description="Vendor category (e.g. food, fruit, flowers, clothing, repair, other)"),
    radius: float = Query(5000.0, gt=0.0, le=50000.0, description="Search radius in meters (default: 5000m)"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of recommended spots to return (default: 10)")
):
    # Validate category if supplied
    if category is not None:
        allowed_categories = [c.value for c in VendorCategory]
        if category.lower() not in allowed_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category '{category}'. Allowed categories: {', '.join(allowed_categories)}"
            )
        category = category.lower()

    db: Database = get_database()
    recommendations = get_recommendations(
        db=db,
        lat=lat,
        lng=lng,
        category=category,
        radius_meters=radius,
        limit=limit
    )

    return success_response(data=recommendations)
