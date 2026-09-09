from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from .geojson import GeoJSONPoint


class VendorCategory(str, Enum):
    FOOD = "food"
    FRUIT = "fruit"
    FLOWERS = "flowers"
    CLOTHING = "clothing"
    REPAIR = "repair"
    OTHER = "other"


class VendorCreate(BaseModel):
    vendor_id: str = Field(..., min_length=1, description="Unique vendor identifier")
    display_name: Optional[str] = Field(None, description="Vendor or stall name")
    category: VendorCategory = Field(..., description="Vendor category")
    business_name: Optional[str] = Field(None, description="Registered or trading business name")
    business_description: Optional[str] = Field(None, description="Short business summary")


class VendorOnboarding(BaseModel):
    display_name: Optional[str] = Field(None, description="Vendor or stall display name")
    business_name: Optional[str] = Field(None, description="Business or stall trade name")
    category: VendorCategory = Field(..., description="Business category")
    business_description: Optional[str] = Field(None, description="Optional business description")
    vendor_id: Optional[str] = Field(None, min_length=1, description="Custom vendor ID (auto-generated if omitted)")
    location: Optional[GeoJSONPoint] = Field(None, description="Initial operating location")


class VendorUpdate(BaseModel):
    display_name: Optional[str] = Field(None, description="Updated vendor or stall name")
    business_name: Optional[str] = Field(None, description="Updated business name")
    business_description: Optional[str] = Field(None, description="Updated business description")
    category: Optional[VendorCategory] = Field(None, description="Updated vendor category")


class VendorResponse(BaseModel):
    vendor_id: str
    user_id: Optional[str] = None
    display_name: Optional[str] = None
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    category: str
    created_at: str
    updated_at: Optional[str] = None
    current_location: Optional[GeoJSONPoint] = None
    last_active_at: Optional[str] = None
