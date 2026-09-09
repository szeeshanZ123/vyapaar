from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

try:
    from backend.db import get_database
    from backend.auth import get_current_user
    from backend.models.user import UserProfileCreate, UserProfileUpdate
    from backend.models.response import success_response
    from backend.crud.users import (
        create_user_profile,
        get_user_profile,
        update_user_profile,
    )
except ImportError:
    from db import get_database
    from auth import get_current_user
    from models.user import UserProfileCreate, UserProfileUpdate
    from models.response import success_response
    from crud.users import (
        create_user_profile,
        get_user_profile,
        update_user_profile,
    )

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.post(
    "/profile",
    status_code=status.HTTP_201_CREATED,
    summary="Create user profile",
    description="Creates a Vyapar application profile in MongoDB for the currently authenticated Supabase user."
)
async def create_profile(
    profile_in: UserProfileCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db: Database = get_database()
    user_id = current_user["user_id"]
    profile = create_user_profile(db, user_id, profile_in)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user profile already exists for this authenticated account."
        )
    return success_response(data=profile)


@router.get(
    "/profile",
    summary="Get current user profile",
    description="Returns the Vyapar profile of the currently authenticated Supabase user."
)
async def get_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db: Database = get_database()
    user_id = current_user["user_id"]
    profile = get_user_profile(db, user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please complete profile setup."
        )
    return success_response(data=profile)


@router.patch(
    "/profile",
    summary="Update current user profile",
    description="Allows the authenticated user to update their name or role."
)
async def update_profile(
    update_in: UserProfileUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    db: Database = get_database()
    user_id = current_user["user_id"]
    updated = update_user_profile(db, user_id, update_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please create a profile first."
        )
    return success_response(data=updated)
