from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from pymongo.database import Database

try:
    from backend.db import get_database
    from backend.models.response import success_response
    from backend.models.vendor import VendorCategory
    from backend.engines.demand import calculate_demand_score, generate_demand_heatmap
except ImportError:
    from db import get_database
    from models.response import success_response
    from models.vendor import VendorCategory
    from engines.demand import calculate_demand_score, generate_demand_heatmap

router = APIRouter(prefix="/api/demand", tags=["Demand Intelligence"])


@router.get(
    "/score",
    summary="Get Demand / Footfall Score",
    description="Calculates a 0–100 Footfall/Demand score from nearby recent vendor check-ins applying recency decay and optional category relevance."
)
async def get_demand_score(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude between -90.0 and 90.0"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Longitude between -180.0 and 180.0"),
    category: Optional[str] = Query(None, description="Optional vendor category (e.g. food, fruit, flowers, clothing, repair, other)"),
    radius: float = Query(1000.0, gt=0.0, le=50000.0, description="Search radius in meters (default: 1000m)")
):
    # Validate category if provided
    if category is not None:
        allowed_categories = [c.value for c in VendorCategory]
        if category.lower() not in allowed_categories:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category '{category}'. Allowed categories: {', '.join(allowed_categories)}"
            )
        category = category.lower()

    db: Database = get_database()
    score_data = calculate_demand_score(
        db=db,
        lat=lat,
        lng=lng,
        category=category,
        radius_meters=radius
    )
    return success_response(data=score_data)


@router.get(
    "/heatmap",
    summary="Get Demand Heatmap Points",
    description="Returns aggregated geographic hotspots with demand scores formatted for frontend map libraries like Leaflet (using GeoJSON [lng, lat] format)."
)
async def get_demand_heatmap(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Center latitude between -90.0 and 90.0"),
    lng: float = Query(..., ge=-180.0, le=180.0, description="Center longitude between -180.0 and 180.0"),
    radius: float = Query(5000.0, gt=0.0, le=50000.0, description="Search radius in meters (default: 5000m)")
):
    db: Database = get_database()
    heatmap_data = generate_demand_heatmap(
        db=db,
        lat=lat,
        lng=lng,
        radius_meters=radius
    )
    return success_response(data=heatmap_data)
