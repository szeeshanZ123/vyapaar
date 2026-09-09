from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    USER = "user"
    VENDOR = "vendor"


class UserProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Full name or nickname")
    role: UserRole = Field(default=UserRole.USER, description="User role ('user' or 'vendor')")


class UserProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Updated name")
    role: Optional[UserRole] = Field(None, description="Updated role ('user' or 'vendor')")


class UserProfileResponse(BaseModel):
    user_id: str
    name: str
    role: str
    created_at: str
    updated_at: str
