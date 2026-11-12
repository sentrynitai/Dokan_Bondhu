# Backwards-compatible re-export
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse
)

__all__ = [
    "RegisterRequest",
    "RegisterResponse",
    "TokenResponse",
    "UserResponse",
]
