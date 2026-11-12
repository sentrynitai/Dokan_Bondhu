from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class PaymentCreate(BaseModel):
    customer_id: int = Field(gt=0)
    sale_id: int | None = Field(default=None, gt=0)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    payment_method: str = Field(default="CASH", pattern="^(CASH|UPI|CARD|BANK_TRANSFER)$")
    notes: str | None = Field(default=None, max_length=255)


class PaymentResponse(BaseModel):
    id: int
    shop_id: int
    customer_id: int | None
    customer_name: str | None = None
    sale_id: int | None
    amount: Decimal
    payment_method: str
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
