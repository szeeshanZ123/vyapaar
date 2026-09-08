from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from pymongo.database import Database

try:
    from backend.models.spot import SpotCreate
except ImportError:
    from models.spot import SpotCreate


def create_spot(db: Database, spot_in: SpotCreate) -> Dict[str, Any]:
    """
    Creates a new vending spot document in MongoDB.
    Location is stored strictly in GeoJSON Point format: [longitude, latitude].
    """
    if spot_in.location:
        geojson_location = {
            "type": "Point",
            "coordinates": spot_in.location.coordinates
        }
    else:
        geojson_location = {
            "type": "Point",
            "coordinates": [spot_in.lng, spot_in.lat]
        }

    # Normalize category_relevance
    cat_rel = spot_in.category_relevance
    if isinstance(cat_rel, str):
        cat_rel = [c.strip().lower() for c in cat_rel.split(",") if c.strip()]
    elif isinstance(cat_rel, list):
        cat_rel = [str(c).strip().lower() for c in cat_rel if str(c).strip()]
    else:
        cat_rel = []

    spot_doc = {
        "name": spot_in.name,
        "location": geojson_location,
        "category_relevance": cat_rel,
        "has_shelter": bool(spot_in.has_shelter),
        "near_transit": bool(spot_in.near_transit),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    result = db.spots.insert_one(spot_doc)
    spot_id = str(result.inserted_id)
    spot_doc["spot_id"] = spot_id
    spot_doc["id"] = spot_id
    spot_doc.pop("_id", None)
    return spot_doc


def get_spot_by_id(db: Database, spot_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches a spot by MongoDB ObjectId or string spot_id.
    """
    query: Dict[str, Any] = {}
    if ObjectId.is_valid(spot_id):
        query = {"$or": [{"_id": ObjectId(spot_id)}, {"spot_id": spot_id}]}
    else:
        query = {"spot_id": spot_id}

    doc = db.spots.find_one(query)
    if not doc:
        return None

    doc["spot_id"] = str(doc.get("_id", doc.get("spot_id", "")))
    doc["id"] = doc["spot_id"]
    doc.pop("_id", None)
    return doc


def get_nearby_spots(
    db: Database,
    lat: float,
    lng: float,
    radius_meters: float = 5000.0
) -> List[Dict[str, Any]]:
    """
    Finds spots within radius_meters using MongoDB 2dsphere spatial index ($near).
    """
    query: Dict[str, Any] = {
        "location": {
            "$near": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [lng, lat]
                },
                "$maxDistance": radius_meters
            }
        }
    }

    cursor = db.spots.find(query)
    spots = []
    for doc in cursor:
        doc["spot_id"] = str(doc.get("_id", doc.get("spot_id", "")))
        doc["id"] = doc["spot_id"]
        doc.pop("_id", None)
        spots.append(doc)

    return spots
