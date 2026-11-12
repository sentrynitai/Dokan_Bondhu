from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class SaleItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    # Backend always reads official selling_price from database, but allows optional custom discounted unit_price if <= selling_price
    unit_price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)


class SaleCreate(BaseModel):
    customer_id: int | None = Field(default=None, gt=0)
    invoice_number: str | None = Field(default=None, max_length=50)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)
    tax: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)
    paid_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    payment_method: str = Field(
        default="CASH",
        pattern="^(CASH|UPI|CARD|CREDIT|MIXED)$"
    )
    notes: str | None = Field(default=None, max_length=255)
    items: list[SaleItemCreate] = Field(min_length=1)


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal

    model_config = ConfigDict(from_attributes=True)


class SaleResponse(BaseModel):
    id: int
    shop_id: int
    customer_id: int | None
    customer_name: str | None = None
    invoice_number: str
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    due_amount: Decimal
    payment_method: str
    status: str
    notes: str | None
    created_at: datetime
    items: list[SaleItemResponse]

    model_config = ConfigDict(from_attributes=True)


class ReceiptShopInfo(BaseModel):
    name: str
    phone: str | None
    address: str | None


class ReceiptCustomerInfo(BaseModel):
    name: str
    phone: str | None
    previous_due: Decimal | None = None
    current_due: Decimal | None = None


class ReceiptResponse(BaseModel):
    invoice_number: str
    date: datetime
    shop: ReceiptShopInfo
    customer: ReceiptCustomerInfo | None = None
    items: list[SaleItemResponse]
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    due_amount: Decimal
    payment_method: str
    notes: str | None = None
