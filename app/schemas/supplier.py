from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SupplierCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    contact_person: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=255)
    initial_balance: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=12,
        decimal_places=2,
        description="Amount the shop currently owes this supplier"
    )


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    contact_person: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class SupplierResponse(BaseModel):
    id: int
    shop_id: int
    name: str
    contact_person: str | None
    phone: str | None
    email: str | None
    address: str | None
    outstanding_balance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
