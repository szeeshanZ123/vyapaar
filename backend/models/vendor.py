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


class VendorUpdate(BaseModel):
    display_name: Optional[str] = Field(None, description="Updated vendor or stall name")
    category: Optional[VendorCategory] = Field(None, description="Updated vendor category")


class VendorResponse(BaseModel):
    vendor_id: str
    display_name: Optional[str] = None
    category: str
    created_at: str
    current_location: Optional[GeoJSONPoint] = None
    last_active_at: Optional[str] = None
