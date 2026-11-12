import csv
import io
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    Query,
    Response
)
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Customer, Product, Sale, ShopMember
from app.dependencies.auth import require_shop_member

router = APIRouter(
    prefix="/shops/{shop_id}/reports",
    tags=["Reports & Exports"]
)

DbSession = Annotated[Session, Depends(get_db)]


# 1. SALES REPORT (JSON)
@router.get("/sales")
def get_sales_report(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)],
    start_date: str | None = Query(default=None, description="YYYY-MM-DD"),
    end_date: str | None = Query(default=None, description="YYYY-MM-DD")
):
    """Returns sales records with totals."""
    stmt = select(Sale).where(Sale.shop_id == shop_id)
    if start_date:
        stmt = stmt.where(Sale.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        stmt = stmt.where(Sale.created_at <= datetime.fromisoformat(end_date + "T23:59:59"))

    stmt = stmt.order_by(Sale.id.desc())
    sales = db.scalars(stmt).all()

    total_revenue = sum((s.total_amount for s in sales), Decimal("0.00"))
    total_paid = sum((s.paid_amount for s in sales), Decimal("0.00"))
    total_due = sum((s.due_amount for s in sales), Decimal("0.00"))

    return {
        "total_invoices": len(sales),
        "total_revenue": total_revenue,
        "total_collected": total_paid,
        "total_due": total_due,
        "sales": [
            {
                "id": s.id,
                "invoice_number": s.invoice_number,
                "subtotal": s.subtotal,
                "discount": s.discount,
                "tax": s.tax,
                "total_amount": s.total_amount,
                "paid_amount": s.paid_amount,
                "due_amount": s.due_amount,
                "payment_method": s.payment_method,
                "created_at": s.created_at
            }
            for s in sales
        ]
    }


# 2. SALES REPORT CSV EXPORT
@router.get("/sales/csv")
def export_sales_csv(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Export all sales transactions as downloadable CSV for Excel."""
    stmt = (
        select(Sale, Customer.name.label("customer_name"))
        .outerjoin(Customer, Sale.customer_id == Customer.id)
        .where(Sale.shop_id == shop_id)
        .order_by(Sale.id.desc())
    )
    rows = db.execute(stmt).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Invoice Number",
        "Date",
        "Customer",
        "Subtotal (INR)",
        "Discount (INR)",
        "Tax (INR)",
        "Total (INR)",
        "Paid (INR)",
        "Due (INR)",
        "Payment Method",
        "Status"
    ])

    for s, cust_name in rows:
        writer.writerow([
            s.invoice_number,
            s.created_at.strftime("%Y-%m-%d %H:%M"),
            cust_name or "Walk-in Customer",
            f"{s.subtotal:.2f}",
            f"{s.discount:.2f}",
            f"{s.tax:.2f}",
            f"{s.total_amount:.2f}",
            f"{s.paid_amount:.2f}",
            f"{s.due_amount:.2f}",
            s.payment_method,
            s.status
        ])

    csv_data = output.getvalue()
    filename = f"sales_report_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# 3. CUSTOMER DUES REPORT
@router.get("/customer-dues")
def get_customer_dues_report(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """List all customers with outstanding credit balance."""
    stmt = (
        select(Customer)
        .where(
            Customer.shop_id == shop_id,
            Customer.is_active.is_(True),
            Customer.outstanding_due > Decimal("0.00")
        )
        .order_by(desc(Customer.outstanding_due))
    )
    customers = db.scalars(stmt).all()
    total_dues = sum((c.outstanding_due for c in customers), Decimal("0.00"))

    return {
        "customer_count": len(customers),
        "total_outstanding_dues": total_dues,
        "customers": [
            {
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "address": c.address,
                "outstanding_due": c.outstanding_due
            }
            for c in customers
        ]
    }


# 4. CUSTOMER DUES CSV EXPORT
@router.get("/customer-dues/csv")
def export_customer_dues_csv(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Export customer dues ledger as downloadable CSV."""
    stmt = (
        select(Customer)
        .where(
            Customer.shop_id == shop_id,
            Customer.is_active.is_(True),
            Customer.outstanding_due > Decimal("0.00")
        )
        .order_by(desc(Customer.outstanding_due))
    )
    customers = db.scalars(stmt).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Customer ID", "Customer Name", "Phone", "Address", "Outstanding Due (INR)"])

    for c in customers:
        writer.writerow([
            c.id,
            c.name,
            c.phone or "N/A",
            c.address or "N/A",
            f"{c.outstanding_due:.2f}"
        ])

    csv_data = output.getvalue()
    filename = f"customer_dues_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# 5. INVENTORY VALUATION CSV EXPORT
@router.get("/inventory/csv")
def export_inventory_csv(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Export full product catalog and stock valuation as CSV."""
    stmt = (
        select(Product, Category.name.label("category_name"))
        .outerjoin(Category, Product.category_id == Category.id)
        .where(Product.shop_id == shop_id, Product.is_active.is_(True))
        .order_by(Product.name.asc())
    )
    rows = db.execute(stmt).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Product ID",
        "SKU",
        "Name",
        "Category",
        "Stock Quantity",
        "Unit",
        "Cost Price (INR)",
        "Selling Price (INR)",
        "Stock Cost Value (INR)",
        "Stock Retail Value (INR)",
        "Low Stock Status"
    ])

    for p, cat_name in rows:
        cost = p.cost_price if p.cost_price is not None else Decimal("0.00")
        cost_val = p.stock_quantity * cost
        retail_val = p.stock_quantity * p.selling_price
        is_low = "YES" if p.stock_quantity <= p.low_stock_threshold else "NO"

        writer.writerow([
            p.id,
            p.sku or "",
            p.name,
            cat_name or "Uncategorized",
            f"{p.stock_quantity:.3f}",
            p.unit,
            f"{cost:.2f}",
            f"{p.selling_price:.2f}",
            f"{cost_val:.2f}",
            f"{retail_val:.2f}",
            is_low
        ])

    csv_data = output.getvalue()
    filename = f"inventory_report_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
