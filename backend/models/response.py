from datetime import datetime, timezone
from typing import Any, Dict, Generic, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ResponseMeta(BaseModel):
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="UTC ISO-8601 timestamp of response creation"
    )


class APIResponse(BaseModel, Generic[T]):
    """
    Standard Vyapar API response envelope:
    {
        "data": ...,
        "error": null | string | dict,
        "meta": {
            "timestamp": "..."
        }
    }
    """
    data: Optional[T] = None
    error: Optional[Any] = None
    meta: ResponseMeta = Field(default_factory=ResponseMeta)


def success_response(data: Any = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Helper to construct a successful envelope response."""
    response_meta = {"timestamp": datetime.now(timezone.utc).isoformat()}
    if meta:
        response_meta.update(meta)
    return {
        "data": data,
        "error": None,
        "meta": response_meta
    }


def error_response(message: str, details: Any = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Helper to construct an error envelope response."""
    response_meta = {"timestamp": datetime.now(timezone.utc).isoformat()}
    if meta:
        response_meta.update(meta)
    return {
        "data": None,
        "error": {
            "message": message,
            "details": details
        } if details else message,
        "meta": response_meta
    }
