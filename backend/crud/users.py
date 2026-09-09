from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pymongo.database import Database
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

try:
    from backend.models.user import UserProfileCreate, UserProfileUpdate
except ImportError:
    from models.user import UserProfileCreate, UserProfileUpdate


def create_user_profile(
    db: Database,
    user_id: str,
    profile_in: UserProfileCreate
) -> Optional[Dict[str, Any]]:
    """
    Creates a new user profile in the MongoDB 'users' collection.
    Returns the created document or None if a profile already exists for this user_id.
    """
    existing = db.users.find_one({"user_id": user_id})
    if existing:
        return None

    now = datetime.now(timezone.utc).isoformat()
    role_val = profile_in.role.value if hasattr(profile_in.role, "value") else str(profile_in.role)

    user_doc = {
        "user_id": user_id,
        "name": profile_in.name,
        "role": role_val,
        "created_at": now,
        "updated_at": now
    }

    try:
        db.users.insert_one(user_doc)
        user_doc.pop("_id", None)
        return user_doc
    except DuplicateKeyError:
        return None


def get_user_profile(db: Database, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches a user profile by Supabase user_id without the internal _id field.
    """
    return db.users.find_one({"user_id": user_id}, {"_id": 0})


def update_user_profile(
    db: Database,
    user_id: str,
    update_in: UserProfileUpdate
) -> Optional[Dict[str, Any]]:
    """
    Updates the authenticated user's profile fields and updated_at timestamp.
    Returns the updated document or None if user not found.
    """
    update_fields = {}
    if update_in.name is not None:
        update_fields["name"] = update_in.name
    if update_in.role is not None:
        role_val = update_in.role.value if hasattr(update_in.role, "value") else str(update_in.role)
        update_fields["role"] = role_val

    if not update_fields:
        return get_user_profile(db, user_id)

    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    updated_doc = db.users.find_one_and_update(
        {"user_id": user_id},
        {"$set": update_fields},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0}
    )
    return updated_doc


def set_user_role(db: Database, user_id: str, role: str) -> Optional[Dict[str, Any]]:
    """
    Updates or ensures user's role is set to the specified role.
    """
    now = datetime.now(timezone.utc).isoformat()
    return db.users.find_one_and_update(
        {"user_id": user_id},
        {
            "$set": {
                "role": role,
                "updated_at": now
            }
        },
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0}
    )
