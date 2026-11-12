from datetime import datetime
from decimal import Decimal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, computed_field, field_validator


class ProductCreate(BaseModel):
    category_id: int | None = Field(default=None, gt=0)
    name: str = Field(min_length=1, max_length=150)
    sku: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=255)
    selling_price: Decimal = Field(
        default=Decimal("0.00"),
        ge=0,
        max_digits=10,
        decimal_places=2
    )
    cost_price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=10,
        decimal_places=2
    )
    stock_quantity: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        max_digits=12,
        decimal_places=3,
        validation_alias=AliasChoices("stock_quantity", "quantity"),
        description="Opening stock quantity for the newly added product"
    )
    unit: str = Field(default="pcs", min_length=1, max_length=20)
    low_stock_threshold: Decimal = Field(
        default=Decimal("5"),
        ge=0,
        max_digits=12,
        decimal_places=3,
        validation_alias=AliasChoices("low_stock_threshold", "low_stock_limit")
    )

    @field_validator("sku", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class ProductUpdate(BaseModel):
    category_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=2, max_length=150)
    sku: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=255)
    selling_price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=10,
        decimal_places=2
    )
    cost_price: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=10,
        decimal_places=2
    )
    # Note: stock_quantity is deliberately omitted to prevent bypassing inventory controls
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    low_stock_threshold: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=3,
        validation_alias=AliasChoices("low_stock_threshold", "low_stock_limit")
    )
    is_active: bool | None = None

    @field_validator("sku", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str) and not v.strip():
            return None
        return v


class ProductResponse(BaseModel):
    id: int
    shop_id: int
    category_id: int | None
    category_name: str | None = None
    name: str
    sku: str | None
    description: str | None = None
    image_url: str | None = None
    selling_price: Decimal
    cost_price: Decimal | None
    stock_quantity: Decimal
    unit: str
    low_stock_threshold: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def quantity(self) -> Decimal:
        return self.stock_quantity

    @computed_field
    @property
    def low_stock_limit(self) -> Decimal:
        return self.low_stock_threshold

    model_config = ConfigDict(from_attributes=True)
