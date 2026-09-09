from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

from backend.models.geojson import GeoJSONPoint


class AlertType(str, Enum):
    crowd = "crowd"
    spot_free = "spot_free"
    road_blocked = "road_blocked"
    municipal_check = "municipal_check"


class AlertStatus(str, Enum):
    active = "active"
    expired = "expired"
    flagged = "flagged"


class AlertCreate(BaseModel):
    alert_type: AlertType = Field(..., description="Type of alert: crowd, spot_free, road_blocked, municipal_check")
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude")
    lng: float = Field(..., ge=-180.0, le=180.0, description="Longitude")
    message: Optional[str] = Field(None, max_length=280, description="Optional brief description of the situation")


class AlertResponse(BaseModel):
    alert_id: str
    user_id: Optional[str] = None
    vendor_id: Optional[str] = None
    location: GeoJSONPoint
    alert_type: AlertType
    message: Optional[str] = None
    confirmations: int = 0
    flags: int = 0
    status: str = "active"
    created_at: str
    expires_at: str
    distance_meters: Optional[float] = None
    widely_surfaced: bool = True
