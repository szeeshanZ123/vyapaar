from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pymongo.database import Database

try:
    from backend.models.checkin import CheckInCreate
    from backend.crud.vendors import get_vendor_by_id, update_vendor_location
except ImportError:
    from models.checkin import CheckInCreate
    from crud.vendors import get_vendor_by_id, update_vendor_location


def create_checkin(db: Database, checkin_in: CheckInCreate) -> Optional[Dict[str, Any]]:
    """
    Creates a check-in document with GeoJSON coordinates [lng, lat],
    and updates the vendor's current_location and last_active_at.
    Returns None if the vendor does not exist.
    """
    # 1. Verify vendor exists
    vendor = get_vendor_by_id(db, checkin_in.vendor_id)
    if not vendor:
        return None

    # 2. Determine category (use check-in category or fallback to vendor category)
    if checkin_in.category is not None:
        cat_val = checkin_in.category.value if hasattr(checkin_in.category, "value") else str(checkin_in.category)
    else:
        cat_val = vendor.get("category", "other")

    # 3. Create GeoJSON Point [longitude, latitude]
    geojson_location = {
        "type": "Point",
        "coordinates": [checkin_in.lng, checkin_in.lat]
    }
    checked_in_at = datetime.now(timezone.utc).isoformat()

    # 4. Insert check-in record
    checkin_doc = {
        "vendor_id": checkin_in.vendor_id,
        "location": geojson_location,
        "category": cat_val,
        "checked_in_at": checked_in_at
    }

    result = db.check_ins.insert_one(checkin_doc)
    checkin_doc["checkin_id"] = str(result.inserted_id)
    checkin_doc.pop("_id", None)

    # 5. Update vendor's current location and last active timestamp
    update_vendor_location(db, checkin_in.vendor_id, geojson_location, checked_in_at)

    return checkin_doc


def get_checkin_history(db: Database, vendor_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Retrieves previous check-ins for a vendor, sorted newest first.
    """
    cursor = db.check_ins.find(
        {"vendor_id": vendor_id}
    ).sort("checked_in_at", -1).limit(limit)

    history = []
    for doc in cursor:
        doc["checkin_id"] = str(doc.pop("_id"))
        history.append(doc)

    return history
