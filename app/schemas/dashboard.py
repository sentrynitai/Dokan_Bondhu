from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class DashboardRecentSale(BaseModel):
    id: int
    invoice_number: str
    customer_name: str | None
    total_amount: Decimal
    paid_amount: Decimal
    payment_method: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardRecentPurchase(BaseModel):
    id: int
    purchase_number: str
    supplier_name: str | None
    total_amount: Decimal
    paid_amount: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TopSellingProduct(BaseModel):
    product_id: int
    product_name: str
    unit: str
    total_sold_quantity: Decimal
    total_revenue: Decimal


class DashboardSummary(BaseModel):
    today_sales_amount: Decimal
    today_sales_count: int
    month_sales_amount: Decimal
    month_sales_count: int
    total_products: int
    total_inventory_units: Decimal
    low_stock_products_count: int
    total_customers: int
    total_outstanding_dues: Decimal
    recent_sales: list[DashboardRecentSale]
    recent_purchases: list[DashboardRecentPurchase]
    top_selling_products: list[TopSellingProduct]
