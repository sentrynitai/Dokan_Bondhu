from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Customer,
    Product,
    Purchase,
    Sale,
    SaleItem,
    ShopMember,
    Supplier
)
from app.schemas.dashboard import (
    DashboardRecentPurchase,
    DashboardRecentSale,
    DashboardSummary,
    TopSellingProduct
)
from app.dependencies.auth import require_shop_member

router = APIRouter(
    prefix="/shops/{shop_id}/dashboard",
    tags=["Dashboard & Analytics"]
)

DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=DashboardSummary)
def get_dashboard_summary(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """
    Computes real-time shop performance analytics:
    - Today's revenue & bill count
    - Current month revenue & bill count
    - Total catalog items & physical inventory units
    - Low-stock alert count
    - Customer count & pending dues total
    - Top 5 best-selling products
    - Recent sales & purchases
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # 1. Today's Sales
    today_sales_stmt = select(
        func.coalesce(func.sum(Sale.total_amount), Decimal("0.00")),
        func.count(Sale.id)
    ).where(
        Sale.shop_id == shop_id,
        Sale.created_at >= today_start
    )
    today_res = db.execute(today_sales_stmt).first()
    today_amount = Decimal(str(today_res[0])) if today_res else Decimal("0.00")
    today_count = int(today_res[1]) if today_res else 0

    # 2. Month's Sales
    month_sales_stmt = select(
        func.coalesce(func.sum(Sale.total_amount), Decimal("0.00")),
        func.count(Sale.id)
    ).where(
        Sale.shop_id == shop_id,
        Sale.created_at >= month_start
    )
    month_res = db.execute(month_sales_stmt).first()
    month_amount = Decimal(str(month_res[0])) if month_res else Decimal("0.00")
    month_count = int(month_res[1]) if month_res else 0

    # 3. Product & Inventory Metrics
    prod_stmt = select(
        func.count(Product.id),
        func.coalesce(func.sum(Product.stock_quantity), Decimal("0.000"))
    ).where(
        Product.shop_id == shop_id,
        Product.is_active.is_(True)
    )
    prod_res = db.execute(prod_stmt).first()
    total_products = int(prod_res[0]) if prod_res else 0
    total_units = Decimal(str(prod_res[1])) if prod_res else Decimal("0.000")

    # 4. Low Stock Count
    low_stock_count = db.scalar(
        select(func.count(Product.id)).where(
            Product.shop_id == shop_id,
            Product.is_active.is_(True),
            Product.stock_quantity <= Product.low_stock_threshold
        )
    ) or 0

    # 5. Customer Metrics
    cust_stmt = select(
        func.count(Customer.id),
        func.coalesce(func.sum(Customer.outstanding_due), Decimal("0.00"))
    ).where(
        Customer.shop_id == shop_id,
        Customer.is_active.is_(True)
    )
    cust_res = db.execute(cust_stmt).first()
    total_cust = int(cust_res[0]) if cust_res else 0
    total_dues = Decimal(str(cust_res[1])) if cust_res else Decimal("0.00")

    # 6. Top Selling Products
    top_stmt = (
        select(
            SaleItem.product_id,
            SaleItem.product_name,
            SaleItem.unit,
            func.sum(SaleItem.quantity).label("total_qty"),
            func.sum(SaleItem.total_price).label("total_rev")
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.shop_id == shop_id)
        .group_by(SaleItem.product_id, SaleItem.product_name, SaleItem.unit)
        .order_by(desc("total_qty"))
        .limit(5)
    )
    top_rows = db.execute(top_stmt).all()
    top_products = [
        TopSellingProduct(
            product_id=r[0],
            product_name=r[1],
            unit=r[2],
            total_sold_quantity=Decimal(str(r[3])),
            total_revenue=Decimal(str(r[4]))
        )
        for r in top_rows
    ]

    # 7. Recent Sales
    recent_sales_stmt = (
        select(Sale, Customer.name.label("customer_name"))
        .outerjoin(Customer, Sale.customer_id == Customer.id)
        .where(Sale.shop_id == shop_id)
        .order_by(Sale.id.desc())
        .limit(5)
    )
    recent_sales_rows = db.execute(recent_sales_stmt).all()
    recent_sales = [
        DashboardRecentSale(
            id=s.id,
            invoice_number=s.invoice_number,
            customer_name=c_name,
            total_amount=s.total_amount,
            paid_amount=s.paid_amount,
            payment_method=s.payment_method,
            created_at=s.created_at
        )
        for s, c_name in recent_sales_rows
    ]

    # 8. Recent Purchases
    recent_purchases_stmt = (
        select(Purchase, Supplier.name.label("supplier_name"))
        .outerjoin(Supplier, Purchase.supplier_id == Supplier.id)
        .where(Purchase.shop_id == shop_id)
        .order_by(Purchase.id.desc())
        .limit(5)
    )
    recent_purchases_rows = db.execute(recent_purchases_stmt).all()
    recent_purchases = [
        DashboardRecentPurchase(
            id=p.id,
            purchase_number=p.purchase_number,
            supplier_name=s_name,
            total_amount=p.total_amount,
            paid_amount=p.paid_amount,
            created_at=p.created_at
        )
        for p, s_name in recent_purchases_rows
    ]

    return DashboardSummary(
        today_sales_amount=today_amount,
        today_sales_count=today_count,
        month_sales_amount=month_amount,
        month_sales_count=month_count,
        total_products=total_products,
        total_inventory_units=total_units,
        low_stock_products_count=low_stock_count,
        total_customers=total_cust,
        total_outstanding_dues=total_dues,
        recent_sales=recent_sales,
        recent_purchases=recent_purchases,
        top_selling_products=top_products
    )
