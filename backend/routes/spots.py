from fastapi import APIRouter, HTTPException, status
from pymongo.database import Database

try:
    from backend.db import get_database
    from backend.models.spot import SpotCreate
    from backend.models.response import success_response
    from backend.crud.spots import create_spot, get_spot_by_id
except ImportError:
    from db import get_database
    from models.spot import SpotCreate
    from models.response import success_response
    from crud.spots import create_spot, get_spot_by_id

router = APIRouter(prefix="/api/spots", tags=["Spots"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new spot",
    description="Registers a vending spot with GeoJSON location and attributes."
)
async def create_new_spot(spot_in: SpotCreate):
    db: Database = get_database()
    spot = create_spot(db, spot_in)
    return success_response(data=spot)


@router.get(
    "/{id}",
    summary="Get spot details by ID",
    description="Fetches details for a specific vending spot."
)
async def get_spot(id: str):
    db: Database = get_database()
    spot = get_spot_by_id(db, id)
    if not spot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Spot with ID '{id}' not found."
        )
    return success_response(data=spot)
