import math
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from pymongo.database import Database
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

try:
    from backend.models.alert import AlertCreate, AlertType, AlertStatus
except ImportError:
    from models.alert import AlertCreate, AlertType, AlertStatus


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates Haversine distance in meters between two coordinates."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def find_duplicate_alert(
    db: Database,
    alert_type: str,
    lat: float,
    lng: float,
    window_minutes: int = 5,
    distance_threshold_meters: float = 100.0
) -> Optional[Dict[str, Any]]:
    """
    Checks if a matching alert of the same type was created within 100 meters and 5 minutes.
    """
    now = datetime.now(timezone.utc)
    cutoff_time = (now - timedelta(minutes=window_minutes)).isoformat()

    # Query recent active alerts of the same type
    cursor = db.alerts.find({
        "alert_type": alert_type,
        "created_at": {"$gte": cutoff_time},
        "status": "active"
    })

    for doc in cursor:
        loc = doc.get("location", {})
        coords = loc.get("coordinates")
        if coords and len(coords) >= 2:
            alert_lng, alert_lat = coords[0], coords[1]
            dist = haversine_distance_meters(lat, lng, alert_lat, alert_lng)
            if dist <= distance_threshold_meters:
                doc["alert_id"] = str(doc.pop("_id"))
                doc["distance_meters"] = round(dist, 1)
                return doc

    return None


def create_alert(
    db: Database,
    alert_in: AlertCreate,
    user_id: str,
    vendor_id: Optional[str] = None
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Creates a new crowdsourced / municipal alert.
    Returns (alert_doc, None) on success or (duplicate_doc, "duplicate") if duplicate detected.
    """
    type_str = alert_in.alert_type.value if hasattr(alert_in.alert_type, "value") else str(alert_in.alert_type)

    # 1. Deduplication check: 100m + 5 mins
    duplicate = find_duplicate_alert(db, type_str, alert_in.lat, alert_in.lng)
    if duplicate:
        return duplicate, "duplicate"

    now = datetime.now(timezone.utc)
    created_at = now.isoformat()
    expires_at = (now + timedelta(minutes=60)).isoformat()

    geojson_location = {
        "type": "Point",
        "coordinates": [alert_in.lng, alert_in.lat]
    }

    alert_doc = {
        "user_id": user_id,
        "vendor_id": vendor_id,
        "alert_type": type_str,
        "message": alert_in.message.strip() if alert_in.message else None,
        "location": geojson_location,
        "confirmations": 1,  # Author implicitly confirms
        "flags": 0,
        "status": "active",
        "created_at": created_at,
        "expires_at": expires_at,
    }

    result = db.alerts.insert_one(alert_doc)
    alert_id = str(result.inserted_id)
    alert_doc["alert_id"] = alert_id
    alert_doc.pop("_id", None)

    # Record author's initial confirmation in alert_confirmations
    try:
        db.alert_confirmations.insert_one({
            "alert_id": alert_id,
            "user_id": user_id,
            "vendor_id": vendor_id,
            "confirmed_at": created_at
        })
    except DuplicateKeyError:
        pass

    return alert_doc, None


def get_alert_by_id(db: Database, alert_id: str) -> Optional[Dict[str, Any]]:
    """Fetches an alert document by ID."""
    doc = None
    if ObjectId.is_valid(alert_id):
        doc = db.alerts.find_one({"_id": ObjectId(alert_id)})
    if not doc:
        doc = db.alerts.find_one({"alert_id": alert_id})
    if doc:
        doc["alert_id"] = str(doc.pop("_id"))
    return doc


def confirm_alert(
    db: Database,
    alert_id: str,
    user_id: str,
    vendor_id: Optional[str] = None
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Confirms an active alert.
    Returns (updated_alert, None) on success, (None, "not_found") if missing/expired,
    or (None, "already_confirmed") if user already confirmed.
    """
    alert = get_alert_by_id(db, alert_id)
    if not alert:
        return None, "not_found"

    now_iso = datetime.now(timezone.utc).isoformat()
    if alert.get("expires_at") and alert["expires_at"] <= now_iso:
        return None, "expired"

    # Check if already confirmed by this user
    existing_conf = db.alert_confirmations.find_one({
        "alert_id": alert["alert_id"],
        "user_id": user_id
    })
    if existing_conf:
        return None, "already_confirmed"

    # Insert confirmation
    try:
        db.alert_confirmations.insert_one({
            "alert_id": alert["alert_id"],
            "user_id": user_id,
            "vendor_id": vendor_id,
            "confirmed_at": now_iso
        })
    except DuplicateKeyError:
        return None, "already_confirmed"

    # Increment confirmation count
    query_id = ObjectId(alert["alert_id"]) if ObjectId.is_valid(alert["alert_id"]) else alert["alert_id"]
    match_filter = {"_id": query_id} if isinstance(query_id, ObjectId) else {"alert_id": query_id}

    updated = db.alerts.find_one_and_update(
        match_filter,
        {"$inc": {"confirmations": 1}},
        return_document=ReturnDocument.AFTER
    )
    if updated:
        updated["alert_id"] = str(updated.pop("_id"))
    return updated, None


def flag_alert(
    db: Database,
    alert_id: str,
    user_id: str
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Flags an alert for moderation.
    Returns (updated_alert, None) on success, (None, "not_found") or (None, "already_flagged").
    """
    alert = get_alert_by_id(db, alert_id)
    if not alert:
        return None, "not_found"

    existing_flag = db.alert_flags.find_one({
        "alert_id": alert["alert_id"],
        "user_id": user_id
    })
    if existing_flag:
        return None, "already_flagged"

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        db.alert_flags.insert_one({
            "alert_id": alert["alert_id"],
            "user_id": user_id,
            "flagged_at": now_iso
        })
    except DuplicateKeyError:
        return None, "already_flagged"

    query_id = ObjectId(alert["alert_id"]) if ObjectId.is_valid(alert["alert_id"]) else alert["alert_id"]
    match_filter = {"_id": query_id} if isinstance(query_id, ObjectId) else {"alert_id": query_id}

    # If flags reach 3 or more, mark as flagged
    new_flags = alert.get("flags", 0) + 1
    update_data = {"$inc": {"flags": 1}}
    if new_flags >= 3:
        update_data["$set"] = {"status": "flagged"}

    updated = db.alerts.find_one_and_update(
        match_filter,
        update_data,
        return_document=ReturnDocument.AFTER
    )
    if updated:
        updated["alert_id"] = str(updated.pop("_id"))
    return updated, None


def get_nearby_alerts(
    db: Database,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_meters: float = 5000.0,
    alert_type: Optional[str] = None,
    current_user_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves active, unexpired alerts within radius_meters.
    Applies the Municipal Confirmation Rule (requires >= 2 confirmations within 15 min to be widely surfaced).
    """
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    query = {
        "status": "active",
        "expires_at": {"$gt": now_iso}
    }
    if alert_type:
        query["alert_type"] = alert_type.lower()

    cursor = db.alerts.find(query)
    results = []

    for doc in cursor:
        doc_id = str(doc.pop("_id"))
        doc["alert_id"] = doc_id

        loc = doc.get("location", {})
        coords = loc.get("coordinates")
        if not coords or len(coords) < 2:
            continue

        a_lng, a_lat = coords[0], coords[1]
        dist = None
        if lat is not None and lng is not None:
            dist = haversine_distance_meters(lat, lng, a_lat, a_lng)
            if dist > radius_meters:
                continue
            doc["distance_meters"] = round(dist, 1)
        else:
            doc["distance_meters"] = None

        # Municipal Alert Confirmation Rule:
        # A municipal_check requires 2 confirmations within 15 mins to be surfaced widely
        is_municipal = doc.get("alert_type") == "municipal_check"
        confirmations = doc.get("confirmations", 0)
        is_author = current_user_id and doc.get("user_id") == current_user_id

        if is_municipal:
            # Check 15-minute confirmation eligibility
            created_at_dt = datetime.fromisoformat(doc["created_at"].replace("Z", "+00:00"))
            age_minutes = (now - created_at_dt).total_seconds() / 60.0
            
            # If 2+ confirmations achieved within window or overall
            is_verified = (confirmations >= 2)
            doc["widely_surfaced"] = is_verified

            # If not yet verified and caller is not the author, don't surface in public feed
            if not is_verified and not is_author:
                continue
        else:
            doc["widely_surfaced"] = True

        results.append(doc)

    # Sort nearest first if location provided, else newest first
    if lat is not None and lng is not None:
        results.sort(key=lambda x: x.get("distance_meters") or 0)
    else:
        results.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    return results
