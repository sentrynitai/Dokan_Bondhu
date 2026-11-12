from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ShopCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)


class ShopUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)


class ShopResponse(BaseModel):
    id: int
    name: str
    phone: str | None
    address: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShopWithRoleResponse(ShopResponse):
    role: str


class ShopMemberAdd(BaseModel):
    email: EmailStr
    role: str = Field(pattern="^(manager|staff)$", description="Role must be 'manager' or 'staff'")


class ShopMemberUpdate(BaseModel):
    role: str = Field(pattern="^(owner|manager|staff)$", description="Role must be 'owner', 'manager', or 'staff'")


class ShopMemberResponse(BaseModel):
    shop_id: int
    user_id: int
    role: str
    user_name: str
    user_email: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
