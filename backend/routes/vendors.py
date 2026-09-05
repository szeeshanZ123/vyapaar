from fastapi import APIRouter, HTTPException, status
from pymongo.database import Database

try:
    from backend.db import get_database
    from backend.models.vendor import VendorCreate, VendorUpdate
    from backend.models.response import success_response
    from backend.crud.vendors import create_vendor, get_vendor_by_id, update_vendor
except ImportError:
    from db import get_database
    from models.vendor import VendorCreate, VendorUpdate
    from models.response import success_response
    from crud.vendors import create_vendor, get_vendor_by_id, update_vendor

router = APIRouter(prefix="/api/vendors", tags=["Vendors"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new vendor",
    description="Registers a street vendor and creates their profile in MongoDB."
)
async def register_vendor(vendor_in: VendorCreate):
    db: Database = get_database()
    vendor = create_vendor(db, vendor_in)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Vendor with vendor_id '{vendor_in.vendor_id}' already exists."
        )
    return success_response(data=vendor)


@router.get(
    "/{vendor_id}",
    summary="Get vendor by ID",
    description="Fetches a vendor's profile including current location and last active timestamp."
)
async def get_vendor(vendor_id: str):
    db: Database = get_database()
    vendor = get_vendor_by_id(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with vendor_id '{vendor_id}' not found."
        )
    return success_response(data=vendor)


@router.patch(
    "/{vendor_id}",
    summary="Update vendor details",
    description="Updates a vendor's display name and/or category."
)
async def update_vendor_details(vendor_id: str, update_in: VendorUpdate):
    db: Database = get_database()
    updated = update_vendor(db, vendor_id, update_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with vendor_id '{vendor_id}' not found."
        )
    return success_response(data=updated)
