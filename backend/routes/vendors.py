from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

try:
    from backend.db import get_database
    from backend.auth import get_current_user
    from backend.models.vendor import VendorCreate, VendorUpdate, VendorOnboarding
    from backend.models.response import success_response
    from backend.crud.vendors import (
        create_vendor,
        create_vendor_profile,
        get_vendor_by_id,
        get_vendor_by_user_id,
        update_vendor,
    )
except ImportError:
    from db import get_database
    from auth import get_current_user
    from models.vendor import VendorCreate, VendorUpdate, VendorOnboarding
    from models.response import success_response
    from crud.vendors import (
        create_vendor,
        create_vendor_profile,
        get_vendor_by_id,
        get_vendor_by_user_id,
        update_vendor,
    )

router = APIRouter(prefix="/api/vendors", tags=["Vendors"])


@router.post(
    "/onboarding",
    status_code=status.HTTP_201_CREATED,
    summary="Vendor business onboarding",
    description="Creates a vendor business profile linked to the currently authenticated Supabase user."
)
async def vendor_onboarding(
    onboarding_in: VendorOnboarding,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db: Database = get_database()
    user_id = current_user["user_id"]
    vendor = create_vendor_profile(db, user_id, onboarding_in)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A vendor profile already exists for this account, or the requested vendor_id is in use."
        )
    return success_response(data=vendor)


@router.get(
    "/me",
    summary="Get authenticated vendor profile",
    description="Returns the vendor profile belonging to the currently authenticated Supabase user."
)
async def get_my_vendor_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db: Database = get_database()
    user_id = current_user["user_id"]
    vendor = get_vendor_by_user_id(db, user_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor business profile not found for this account. Please complete vendor onboarding."
        )
    return success_response(data=vendor)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Register a new vendor",
    description="Registers a street vendor and creates their profile in MongoDB (Phase 2 legacy)."
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
    description="Updates a vendor's display name, business name, and/or category."
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
