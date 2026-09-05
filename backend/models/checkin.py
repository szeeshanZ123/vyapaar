from typing import Optional
from pydantic import BaseModel, Field, field_validator
from .geojson import GeoJSONPoint
from .vendor import VendorCategory


class CheckInCreate(BaseModel):
    vendor_id: str = Field(..., min_length=1, description="Vendor identifier")
    lat: float = Field(..., description="Latitude between -90.0 and 90.0")
    lng: float = Field(..., description="Longitude between -180.0 and 180.0")
    category: Optional[VendorCategory] = Field(None, description="Category of goods during this check-in")

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (-90.0 <= v <= 90.0):
            raise ValueError(f"Latitude ({v}) must be between -90.0 and 90.0.")
        return v

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, v: float) -> float:
        if not (-180.0 <= v <= 180.0):
            raise ValueError(f"Longitude ({v}) must be between -180.0 and 180.0.")
        return v


class CheckInResponse(BaseModel):
    checkin_id: Optional[str] = None
    vendor_id: str
    location: GeoJSONPoint
    category: str
    checked_in_at: str
