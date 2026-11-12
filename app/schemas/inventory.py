from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


from typing import Literal


class StockChangeRequest(BaseModel):
    quantity: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=3
    )
    reason: str = Field(
        default="Stock change",
        min_length=1,
        max_length=255
    )


class StockUpdateRequest(BaseModel):
    action: Literal["increase", "decrease", "IN", "OUT"]
    quantity: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=3
    )
    reason: str | None = Field(
        default=None,
        max_length=255
    )


class StockAdjustRequest(BaseModel):
    counted_quantity: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=3,
        description="The actual counted quantity in physical inventory"
    )
    reason: str = Field(
        min_length=3,
        max_length=255,
        default="Physical Stock Audit",
        description="Reason for adjustment, e.g. Audit, Damaged goods, Expired"
    )


class StockMovementResponse(BaseModel):
    id: int
    shop_id: int
    product_id: int
    product_name: str | None = None
    movement_type: str
    quantity: Decimal
    quantity_before: Decimal
    quantity_after: Decimal
    reason: str
    created_by: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventorySummaryResponse(BaseModel):
    total_products: int
    total_units_in_stock: Decimal
    total_stock_quantity: Decimal | None = None
    total_cost_valuation: Decimal = Decimal("0.00")
    total_retail_valuation: Decimal = Decimal("0.00")
    low_stock_count: int
    low_stock_products: int = 0
    out_of_stock_products: int = 0
    total_low_stock: int = 0

