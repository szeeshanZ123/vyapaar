from typing import Annotated, List, Literal, Tuple
from pydantic import BaseModel, Field, field_validator


class GeoJSONPoint(BaseModel):
    """
    Standard GeoJSON Point representation for MongoDB 2dsphere indexing.
    
    IMPORTANT:
    Coordinates must strictly follow the format: [longitude, latitude]
    - Longitude: between -180.0 and 180.0 (X axis)
    - Latitude: between -90.0 and 90.0 (Y axis)
    """
    type: Literal["Point"] = "Point"
    coordinates: List[float] = Field(
        ...,
        description="Coordinates in [longitude, latitude] order (longitude first, latitude second)",
        min_length=2,
        max_length=2,
        examples=[[77.2090, 28.6139]]  # [longitude, latitude]
    )

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, v: List[float]) -> List[float]:
        if len(v) != 2:
            raise ValueError("Coordinates must contain exactly [longitude, latitude].")
        
        lon, lat = v[0], v[1]
        if not (-180.0 <= lon <= 180.0):
            raise ValueError(f"Longitude ({lon}) must be between -180.0 and 180.0.")
        if not (-90.0 <= lat <= 90.0):
            raise ValueError(f"Latitude ({lat}) must be between -90.0 and 90.0.")
        return v
