from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pymongo.database import Database
from pymongo import ReturnDocument

try:
    from backend.models.vendor import VendorCreate, VendorUpdate
except ImportError:
    from models.vendor import VendorCreate, VendorUpdate


def create_vendor(db: Database, vendor_in: VendorCreate) -> Optional[Dict[str, Any]]:
    """
    Registers a new vendor in MongoDB.
    Returns the created vendor document (without _id) or None if duplicate.
    """
    existing = db.vendors.find_one({"vendor_id": vendor_in.vendor_id})
    if existing:
        return None

    vendor_doc = {
        "vendor_id": vendor_in.vendor_id,
        "display_name": vendor_in.display_name,
        "category": vendor_in.category.value if hasattr(vendor_in.category, "value") else str(vendor_in.category),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "current_location": None,
        "last_active_at": None,
    }

    db.vendors.insert_one(vendor_doc)
    # Remove MongoDB internal _id before returning
    vendor_doc.pop("_id", None)
    return vendor_doc


def get_vendor_by_id(db: Database, vendor_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches a vendor document by vendor_id without the internal _id field.
    """
    return db.vendors.find_one({"vendor_id": vendor_id}, {"_id": 0})


def update_vendor(db: Database, vendor_id: str, update_in: VendorUpdate) -> Optional[Dict[str, Any]]:
    """
    Updates a vendor's display_name and/or category.
    Returns the updated vendor document or None if vendor not found.
    """
    update_fields = {}
    if update_in.display_name is not None:
        update_fields["display_name"] = update_in.display_name
    if update_in.category is not None:
        category_val = update_in.category.value if hasattr(update_in.category, "value") else str(update_in.category)
        update_fields["category"] = category_val

    if not update_fields:
        return get_vendor_by_id(db, vendor_id)

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
                "last_active_at": last_active_at
            }
        },
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0}
    )
