import uuid
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Product, Purchase, PurchaseItem, Supplier
from app.schemas.purchase import PurchaseCreate, PurchaseResponse, PurchaseItemResponse
from app.services.inventory_service import apply_stock_change


def generate_purchase_number(shop_id: int) -> str:
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:6].upper()
    return f"PO-{now_str}-{short_uuid}"


def create_purchase_transaction(
    db: Session,
    shop_id: int,
    payload: PurchaseCreate,
    user_id: int
) -> Purchase:
    """
    Executes a supplier purchase order within a single atomic database transaction:
    1. Validates supplier if provided.
    2. For each item:
       - Validates product belongs to shop and is active.
       - Increases inventory with StockMovement ("IN", reason="Purchase PO-...").
       - Optionally updates the product's cost_price.
       - Creates PurchaseItem.
    3. Calculates total amount on backend.
    4. If unpaid amount remains and supplier is specified, increases supplier's outstanding_balance.
    5. Saves and returns the Purchase.
    """
    supplier = None
    if payload.supplier_id:
        supplier = db.scalar(
            select(Supplier).where(
                Supplier.id == payload.supplier_id,
                Supplier.shop_id == shop_id,
                Supplier.is_active.is_(True)
            )
        )
        if not supplier:
            raise HTTPException(status_code=400, detail="Supplier not found or inactive")

    purchase_number = payload.purchase_number.strip() if payload.purchase_number else generate_purchase_number(shop_id)

    # Check uniqueness of purchase_number for this shop
    existing_po = db.scalar(
        select(Purchase).where(
            Purchase.shop_id == shop_id,
            Purchase.purchase_number == purchase_number
        )
    )
    if existing_po:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Purchase number '{purchase_number}' already exists in this shop"
        )

    total_amount = Decimal("0.00")
    purchase_items = []

    for item_in in payload.items:
        # Fetch and lock product
        product = db.scalar(
            select(Product)
            .where(
                Product.id == item_in.product_id,
                Product.shop_id == shop_id
            )
            .with_for_update()
        )
        if not product:
            raise HTTPException(
                status_code=400,
                detail=f"Product ID {item_in.product_id} not found in this shop"
            )
        if not product.is_active:
            raise HTTPException(
                status_code=409,
                detail=f"Product '{product.name}' is inactive and cannot be purchased"
            )

        line_total = (item_in.quantity * item_in.unit_cost).quantize(Decimal("0.01"))
        total_amount += line_total

        # Apply stock increase
        apply_stock_change(
            db=db,
            shop_id=shop_id,
            product_id=product.id,
            quantity=item_in.quantity,
            movement_type="IN",
            reason=f"Purchase {purchase_number}",
            user_id=user_id
        )

        # Update product cost price if requested
        if payload.update_product_cost:
            product.cost_price = item_in.unit_cost

        p_item = PurchaseItem(
            product_id=product.id,
            quantity=item_in.quantity,
            unit_cost=item_in.unit_cost,
            total_cost=line_total
        )
        purchase_items.append(p_item)

    paid = payload.paid_amount
    if paid > total_amount:
        raise HTTPException(
            status_code=422,
            detail="Paid amount cannot exceed total purchase amount"
        )

    # Update supplier balance for unpaid amount
    unpaid = total_amount - paid
    if supplier and unpaid > Decimal("0.00"):
        supplier.outstanding_balance += unpaid

    purchase = Purchase(
        shop_id=shop_id,
        supplier_id=payload.supplier_id,
        purchase_number=purchase_number,
        total_amount=total_amount,
        paid_amount=paid,
        status="COMPLETED",
        notes=payload.notes.strip() if payload.notes else None,
        created_by=user_id,
        items=purchase_items
    )

    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase
