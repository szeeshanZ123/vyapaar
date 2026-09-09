import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pymongo.database import Database
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

try:
    from backend.models.vendor import VendorCreate, VendorUpdate, VendorOnboarding
    from backend.crud.users import set_user_role
except ImportError:
    from models.vendor import VendorCreate, VendorUpdate, VendorOnboarding
    from crud.users import set_user_role


def create_vendor(db: Database, vendor_in: VendorCreate) -> Optional[Dict[str, Any]]:
    """
    Registers a new legacy vendor in MongoDB without Supabase auth binding (Phase 2 compatibility).
    Returns the created vendor document (without _id) or None if duplicate.
    """
    existing = db.vendors.find_one({"vendor_id": vendor_in.vendor_id})
    if existing:
        return None

    now = datetime.now(timezone.utc).isoformat()
    vendor_doc = {
        "vendor_id": vendor_in.vendor_id,
        "display_name": vendor_in.display_name,
        "business_name": getattr(vendor_in, "business_name", None),
        "business_description": getattr(vendor_in, "business_description", None),
        "category": vendor_in.category.value if hasattr(vendor_in.category, "value") else str(vendor_in.category),
        "created_at": now,
        "updated_at": now,
        "current_location": None,
        "last_active_at": None,
    }

    try:
        db.vendors.insert_one(vendor_doc)
        vendor_doc.pop("_id", None)
        return vendor_doc
    except DuplicateKeyError:
        return None


def create_vendor_profile(
    db: Database,
    user_id: str,
    onboarding_in: VendorOnboarding
) -> Optional[Dict[str, Any]]:
    """
    Onboards a vendor and creates their business profile linked to their Supabase user_id.
    Returns None if a vendor profile already exists for this user_id.
    """
    # 1. Prevent duplicate vendor profile for this Supabase user
    existing_by_user = db.vendors.find_one({"user_id": user_id})
    if existing_by_user:
        return None

    # 2. Determine unique vendor_id
    if onboarding_in.vendor_id and onboarding_in.vendor_id.strip():
        candidate_id = onboarding_in.vendor_id.strip()
        if db.vendors.find_one({"vendor_id": candidate_id}):
            # Specified ID already exists
            return None
        vendor_id = candidate_id
    else:
        # Generate stable, clean vendor_id from user_id prefix or UUID
        prefix = user_id.replace("-", "")[:8]
        candidate_id = f"vnd_{prefix}"
        if db.vendors.find_one({"vendor_id": candidate_id}):
            candidate_id = f"vnd_{prefix}_{uuid.uuid4().hex[:4]}"
        vendor_id = candidate_id

    now = datetime.now(timezone.utc).isoformat()
    cat_val = (
        onboarding_in.category.value
        if hasattr(onboarding_in.category, "value")
        else str(onboarding_in.category)
    )

    location_data = None
    if onboarding_in.location:
        location_data = onboarding_in.location.model_dump() if hasattr(onboarding_in.location, "model_dump") else onboarding_in.location.dict()

    vendor_doc = {
        "vendor_id": vendor_id,
        "user_id": user_id,
        "display_name": onboarding_in.display_name or onboarding_in.business_name or f"Vendor {vendor_id}",
        "business_name": onboarding_in.business_name,
        "business_description": onboarding_in.business_description,
        "category": cat_val,
        "created_at": now,
        "updated_at": now,
        "current_location": location_data,
        "last_active_at": now if location_data else None,
    }

    try:
        db.vendors.insert_one(vendor_doc)
        vendor_doc.pop("_id", None)
        # Synchronize user role to "vendor" in users collection if profile exists
        set_user_role(db, user_id, "vendor")
        return vendor_doc
    except DuplicateKeyError:
        return None


def get_vendor_by_id(db: Database, vendor_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches a vendor document by vendor_id without the internal _id field.
    """
    return db.vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})


def get_vendor_by_user_id(db: Database, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches a vendor profile associated with the Supabase user_id.
    """
    return db.vendors.find_one({"user_id": user_id}, {"_id": 0})


def update_vendor(db: Database, vendor_id: str, update_in: VendorUpdate) -> Optional[Dict[str, Any]]:
    """
    Updates a vendor's details (display_name, business_name, business_description, category).
    Returns the updated vendor document or None if vendor not found.
    """
    update_fields = {}
    if update_in.display_name is not None:
        update_fields["display_name"] = update_in.display_name
    if getattr(update_in, "business_name", None) is not None:
        update_fields["business_name"] = update_in.business_name
    if getattr(update_in, "business_description", None) is not None:
        update_fields["business_description"] = update_in.business_description
    if update_in.category is not None:
        category_val = update_in.category.value if hasattr(update_in.category, "value") else str(update_in.category)
        update_fields["category"] = category_val

    if not update_fields:
        return get_vendor_by_id(db, vendor_id)

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    updated_doc = db.vendors.find_one_and_update(
        {"vendor_id": vendor_id},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0}
    )
    return updated_doc


def update_vendor_location(
    db: Database,
    vendor_id: str,
    location: Dict[str, Any],
    last_active_at: str
) -> Optional[Dict[str, Any]]:
    """
    Updates the vendor's current_location and last_active_at fields upon check-in.
    """
    return db.vendors.find_one_and_update(
        {"vendor_id": vendor_id},
        {
            "$set": {
                "current_location": location,
                "last_active_at": last_active_at,
                "updated_at": last_active_at
            }
        },
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0}
    )


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def get_active_vendors(
    db: Database,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_meters: float = 5000.0,
    category: Optional[str] = None,
    exclude_vendor_id: Optional[str] = None
) -> list:
    """
    Returns active vendors within radius_meters with calculated distance.
    """
    query = {"current_location": {"$ne": None}}
    if category:
        query["category"] = category.lower()
    if exclude_vendor_id:
        query["vendor_id"] = {"$ne": exclude_vendor_id}

    cursor = db.vendors.find(query, {"_id": 0})
    results = []

    for v in cursor:
        loc = v.get("current_location")
        if not loc or not isinstance(loc, dict):
            continue
        coords = loc.get("coordinates")
        if not coords or len(coords) < 2:
            continue
        
        v_lng, v_lat = coords[0], coords[1]
        
        if lat is not None and lng is not None:
            dist = haversine_distance_meters(lat, lng, v_lat, v_lng)
            if dist > radius_meters:
                continue
            v["distance_meters"] = round(dist, 1)
        else:
            v["distance_meters"] = None

        results.append(v)

    if lat is not None and lng is not None:
        results.sort(key=lambda x: x.get("distance_meters") or 0)

    return results
