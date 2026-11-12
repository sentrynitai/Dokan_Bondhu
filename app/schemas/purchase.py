from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class PurchaseItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    unit_cost: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class PurchaseCreate(BaseModel):
    supplier_id: int | None = Field(default=None, gt=0)
    purchase_number: str | None = Field(default=None, max_length=50)
    paid_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    notes: str | None = Field(default=None, max_length=255)
    update_product_cost: bool = Field(default=True, description="Update product's master cost price")
    items: list[PurchaseItemCreate] = Field(min_length=1)


class PurchaseItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str | None = None
    quantity: Decimal
    unit_cost: Decimal
    total_cost: Decimal

    model_config = ConfigDict(from_attributes=True)


class PurchaseResponse(BaseModel):
    id: int
    shop_id: int
    supplier_id: int | None
    supplier_name: str | None = None
    purchase_number: str
    total_amount: Decimal
    paid_amount: Decimal
    status: str
    notes: str | None
    created_at: datetime
    items: list[PurchaseItemResponse]

    model_config = ConfigDict(from_attributes=True)
