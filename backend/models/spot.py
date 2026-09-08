from typing import Any, List, Optional, Union
from pydantic import BaseModel, Field, model_validator
from .geojson import GeoJSONPoint


class SpotCreate(BaseModel):
    """
    Schema for creating a new spot.
    Supports either GeoJSON location or lat & lng fields.
    """
    name: str = Field(..., min_length=1, description="Name or title of the vending spot")
    location: Optional[GeoJSONPoint] = Field(None, description="GeoJSON Point [longitude, latitude]")
    lat: Optional[float] = Field(None, description="Latitude between -90.0 and 90.0")
    lng: Optional[float] = Field(None, description="Longitude between -180.0 and 180.0")
    category_relevance: Optional[Union[List[str], str]] = Field(
        default_factory=list,
        description="Relevant vendor categories (e.g. ['food', 'fruit'] or 'food')"
    )
    has_shelter: bool = Field(False, description="Whether the spot provides weather protection/shelter")
    near_transit: bool = Field(False, description="Whether the spot is near public transit (bus, metro, station)")

    @model_validator(mode="before")
    @classmethod
    def validate_location_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            loc = data.get("location")
            lat = data.get("lat")
            lng = data.get("lng")

            if loc is None:
                if lat is None or lng is None:
                    raise ValueError("Must provide either 'location' as GeoJSON Point or both 'lat' and 'lng'.")
                if not (-90.0 <= float(lat) <= 90.0):
                    raise ValueError(f"Latitude ({lat}) must be between -90.0 and 90.0.")
                if not (-180.0 <= float(lng) <= 180.0):
                    raise ValueError(f"Longitude ({lng}) must be between -180.0 and 180.0.")
                data["location"] = {"type": "Point", "coordinates": [float(lng), float(lat)]}
        return data


class SpotResponse(BaseModel):
    """
    Response model for a Spot document.
    """
    spot_id: str
    id: Optional[str] = None
    name: str
    location: GeoJSONPoint
    category_relevance: Union[List[str], str, None] = None
    has_shelter: bool = False
    near_transit: bool = False
    created_at: str


class RecommendationItem(BaseModel):
    """
    Response model for a single recommended spot.
    """
    spot_id: str
    id: Optional[str] = None
    spot_name: str
    name: str
    location: GeoJSONPoint
    demand_score: int = Field(..., ge=0, le=100, description="Footfall/Demand score (0-100)")
    demand_level: Optional[str] = None
    recommendation_score: int = Field(..., ge=0, le=100, description="Overall recommendation score (0-100)")
    distance: float = Field(..., description="Distance in meters")
    distance_meters: Optional[float] = None
    category_relevance: Union[List[str], str, None] = None
    has_shelter: bool = False
    near_transit: bool = False
