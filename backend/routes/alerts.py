from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

try:
    from backend.db import get_database
    from backend.auth import get_current_user, get_optional_current_user
    from backend.models.alert import AlertCreate, AlertType
    from backend.models.response import success_response
    from backend.crud.alerts import (
        create_alert,
        confirm_alert,
        flag_alert,
        get_alert_by_id,
        get_nearby_alerts,
    )
    from backend.crud.vendors import get_vendor_by_user_id
except ImportError:
    from db import get_database
    from auth import get_current_user, get_optional_current_user
    from models.alert import AlertCreate, AlertType
    from models.response import success_response
    from crud.alerts import (
        create_alert,
        confirm_alert,
        flag_alert,
        get_alert_by_id,
        get_nearby_alerts,
    )
    from crud.vendors import get_vendor_by_user_id

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create crowdsourced or municipal alert",
    description="Creates a location-based alert with 60-minute expiry and 100m/5min deduplication check."
)
@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
async def report_alert(
    alert_in: AlertCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db: Database = get_database()
    user_id = current_user["user_id"]

    # Identify vendor_id if caller is an onboarded vendor
    vendor_id = None
    auth_vendor = get_vendor_by_user_id(db, user_id)
    if auth_vendor:
        vendor_id = auth_vendor.get("vendor_id")

    alert, reason = create_alert(db, alert_in, user_id=user_id, vendor_id=vendor_id)
    if reason == "duplicate":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A similar active alert of type '{alert_in.alert_type.value}' was already reported within 100 meters in the last 5 minutes (Alert ID: {alert['alert_id']})."
        )

    return success_response(data=alert)


@router.get(
    "/nearby",
    summary="Get active nearby alerts",
    description="Returns active unexpired alerts within search radius. Municipal alerts require 2 confirmations within 15 min to be surfaced widely."
)
async def list_nearby_alerts(
    lat: Optional[float] = Query(None, ge=-90.0, le=90.0, description="Current latitude"),
    lng: Optional[float] = Query(None, ge=-180.0, le=180.0, description="Current longitude"),
    radius: float = Query(5000.0, gt=0.0, le=50000.0, description="Search radius in meters"),
    alert_type: Optional[str] = Query(None, description="Optional alert type filter (crowd, spot_free, road_blocked, municipal_check)"),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
):
    db: Database = get_database()
    caller_id = current_user["user_id"] if current_user else None

    alerts = get_nearby_alerts(
        db=db,
        lat=lat,
        lng=lng,
        radius_meters=radius,
        alert_type=alert_type,
        current_user_id=caller_id
    )
    return success_response(data=alerts)


@router.get(
    "/{alert_id}",
    summary="Get alert details by ID"
)
async def get_single_alert(alert_id: str):
    db: Database = get_database()
    alert = get_alert_by_id(db, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID '{alert_id}' was not found."
        )
    return success_response(data=alert)


@router.post(
    "/{alert_id}/confirm",
    summary="Confirm an existing alert",
    description="Increments the confirmation count. Prevents duplicate confirmation by the same account."
)
async def confirm_existing_alert(
    alert_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db: Database = get_database()
    user_id = current_user["user_id"]

    vendor_id = None
    auth_vendor = get_vendor_by_user_id(db, user_id)
    if auth_vendor:
        vendor_id = auth_vendor.get("vendor_id")

    updated_alert, err = confirm_alert(db, alert_id, user_id=user_id, vendor_id=vendor_id)
    if err == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID '{alert_id}' not found."
        )
    if err == "expired":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Cannot confirm this alert because it has already expired."
        )
    if err == "already_confirmed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already confirmed this alert."
        )

    return success_response(data=updated_alert)


@router.post(
    "/{alert_id}/flag",
    summary="Flag an alert for moderation",
    description="Flags an alert. If an alert receives 3+ flags, it is removed from active circulation."
)
async def flag_existing_alert(
    alert_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db: Database = get_database()
    user_id = current_user["user_id"]

    updated_alert, err = flag_alert(db, alert_id, user_id=user_id)
    if err == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID '{alert_id}' not found."
        )
    if err == "already_flagged":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already flagged this alert."
        )

    return success_response(data=updated_alert)
