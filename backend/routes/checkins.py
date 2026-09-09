from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

try:
    from backend.db import get_database
    from backend.auth import get_optional_current_user
    from backend.models.checkin import CheckInCreate
    from backend.models.response import success_response
    from backend.crud.checkins import create_checkin, get_checkin_history
    from backend.crud.vendors import get_vendor_by_user_id
except ImportError:
    from db import get_database
    from auth import get_optional_current_user
    from models.checkin import CheckInCreate
    from models.response import success_response
    from crud.checkins import create_checkin, get_checkin_history
    from crud.vendors import get_vendor_by_user_id

router = APIRouter(prefix="/api/checkins", tags=["Check-ins"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Record vendor check-in",
    description="Records a check-in with GeoJSON coordinates [lng, lat] and updates the vendor's current location and activity timestamp. If authenticated, validates caller identity against their vendor profile."
)
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
async def vendor_checkin(
    checkin_in: CheckInCreate,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    db: Database = get_database()

    # If caller is authenticated with Supabase, enforce ownership
    if current_user:
        auth_vendor = get_vendor_by_user_id(db, current_user["user_id"])
        if not auth_vendor:
            # Check if vendor details are available in user_metadata to self-heal
            raw_meta = (current_user.get("raw_payload") or {}).get("user_metadata") or {}
            disp_name = raw_meta.get("name") or (current_user.get("email") or "Vendor").split("@")[0]
            biz_name = raw_meta.get("business_name") or disp_name
            cat_name = raw_meta.get("category") or checkin_in.category or "food"
            cat_str = cat_name.value if hasattr(cat_name, "value") else str(cat_name)
            
            try:
                from backend.crud.vendors import create_vendor_profile
                from backend.models.vendor import VendorOnboarding
            except ImportError:
                from crud.vendors import create_vendor_profile
                from models.vendor import VendorOnboarding
            
            onboarding_obj = VendorOnboarding(
                display_name=disp_name,
                business_name=biz_name,
                category=cat_str,
                business_description=raw_meta.get("business_description")
            )
            auth_vendor = create_vendor_profile(db, current_user["user_id"], onboarding_obj)
            if not auth_vendor:
                auth_vendor = get_vendor_by_user_id(db, current_user["user_id"])

        if not auth_vendor:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authenticated user does not have a vendor business profile. Please complete vendor onboarding first."
            )
        # Prevent submitting check-in for another vendor
        if checkin_in.vendor_id and checkin_in.vendor_id != auth_vendor["vendor_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied: You cannot create check-ins for another vendor account."
            )
        checkin_in.vendor_id = auth_vendor["vendor_id"]
    else:
        # Unauthenticated request MUST supply vendor_id or be rejected with 401
        if not checkin_in.vendor_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required: Please provide an Authorization Bearer token or vendor_id in request body."
            )

    checkin = create_checkin(db, checkin_in)
    if not checkin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Check-in failed: Vendor with vendor_id '{checkin_in.vendor_id}' does not exist."
        )
    return success_response(data=checkin)


@router.get(
    "/history",
    summary="Get vendor check-in history",
    description="Returns previous check-in locations for a specific vendor, sorted newest first."
)
async def checkin_history(
    vendor_id: str = Query(..., min_length=1, description="Vendor ID to fetch history for"),
    limit: int = Query(50, ge=1, le=200, description="Max number of records to return")
):
    db: Database = get_database()
    history = get_checkin_history(db, vendor_id, limit=limit)
    return success_response(data=history)
