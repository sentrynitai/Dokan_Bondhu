import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Customer, Payment, Product, Sale, SaleItem
from app.schemas.sale import SaleCreate
from app.services.inventory_service import apply_stock_change


def generate_invoice_number(shop_id: int) -> str:
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    short_code = uuid.uuid4().hex[:6].upper()
    return f"INV-{date_str}-{short_code}"


def create_sale_transaction(
    db: Session,
    shop_id: int,
    payload: SaleCreate,
    user_id: int
) -> Sale:
    """
    Executes a Point-of-Sale (POS) transaction atomically:
    1. Validates customer (if selected).
    2. Sorts items by product_id to prevent database deadlocks.
    3. Acquires exclusive row locks via with_for_update() and validates stock.
    4. Calculates line totals and subtotal using verified database pricing.
    5. Deducts inventory and logs StockMovement ('OUT', reason='Sale INV-...').
    6. Stores historical snapshot of product name and unit price in SaleItem.
    7. Applies discount and tax to determine total_amount.
    8. Updates customer's outstanding_due if credit/due exists.
    9. Records Payment entry if paid_amount > 0.
    10. Commits all changes in one single atomic transaction.
    """
    customer = None
    if payload.customer_id:
        customer = db.scalar(
            select(Customer).where(
                Customer.id == payload.customer_id,
                Customer.shop_id == shop_id,
                Customer.is_active.is_(True)
            )
        )
        if not customer:
            raise HTTPException(status_code=400, detail="Customer not found in this shop")

    invoice_number = payload.invoice_number.strip() if payload.invoice_number else generate_invoice_number(shop_id)

    # Check invoice number uniqueness
    existing_sale = db.scalar(
        select(Sale).where(
            Sale.shop_id == shop_id,
            Sale.invoice_number == invoice_number
        )
    )
    if existing_sale:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invoice number '{invoice_number}' already exists in this shop"
        )

    # Deadlock prevention: sort items by product_id
    sorted_items = sorted(payload.items, key=lambda x: x.product_id)

    subtotal = Decimal("0.00")
    sale_items = []

    for item_in in sorted_items:
        # 1. Fetch product with pessimistic row lock
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
                status_code=404,
                detail=f"Product with ID {item_in.product_id} not found in this shop"
            )

        if not product.is_active:
            raise HTTPException(
                status_code=409,
                detail=f"Product '{product.name}' is inactive and cannot be sold"
            )

        # 2. Check stock availability
        if item_in.quantity > product.stock_quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient stock for '{product.name}'. Available: {product.stock_quantity} {product.unit}, Requested: {item_in.quantity} {product.unit}"
            )

        # 3. Determine price
        if item_in.unit_price is not None and item_in.unit_price >= 0:
            price = item_in.unit_price
        else:
            price = product.selling_price

        line_total = (item_in.quantity * price).quantize(Decimal("0.01"))
        subtotal += line_total

        # 4. Deduct inventory via StockMovement
        apply_stock_change(
            db=db,
            shop_id=shop_id,
            product_id=product.id,
            quantity=item_in.quantity,
            movement_type="OUT",
            reason=f"Sale {invoice_number}",
            user_id=user_id
        )

        # 5. Snapshot product details in sale item
        sale_item = SaleItem(
            product_id=product.id,
            product_name=product.name,
            unit=product.unit,
            quantity=item_in.quantity,
            unit_price=price,
            total_price=line_total
        )
        sale_items.append(sale_item)

    # 6. Financial Calculations
    total_amount = (subtotal - payload.discount + payload.tax).quantize(Decimal("0.01"))
    if total_amount < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Discount cannot exceed bill subtotal"
        )

    paid = payload.paid_amount
    if paid > total_amount:
        # In retail, if customer gives excess cash, shopkeeper returns change; paid is capped at total_amount
        paid = total_amount

    due = (total_amount - paid).quantize(Decimal("0.01"))

    # Disallow unpaid balance for walk-in (unregistered) customers
    if due > Decimal("0.00") and customer is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Credit / Unpaid due is only permitted for registered customers. Please select or add a customer."
        )

    # Update customer due
    if due > Decimal("0.00") and customer:
        customer.outstanding_due += due

    sale = Sale(
        shop_id=shop_id,
        customer_id=payload.customer_id,
        invoice_number=invoice_number,
        subtotal=subtotal,
        discount=payload.discount,
        tax=payload.tax,
        total_amount=total_amount,
        paid_amount=paid,
        due_amount=due,
        payment_method=payload.payment_method,
        status="COMPLETED",
        notes=payload.notes.strip() if payload.notes else None,
        created_by=user_id,
        items=sale_items
    )

    db.add(sale)
    db.flush()

    # Record initial payment in payments ledger if paid > 0
    if paid > Decimal("0.00"):
        payment = Payment(
            shop_id=shop_id,
            customer_id=payload.customer_id,
            sale_id=sale.id,
            amount=paid,
            payment_method=payload.payment_method,
            notes=f"Bill Payment for {invoice_number}",
            created_by=user_id
        )
        db.add(payment)

    db.commit()
    db.refresh(sale)
    return sale
