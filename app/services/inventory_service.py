from decimal import Decimal
from typing import Literal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Product, StockMovement


def apply_stock_change(
    db: Session,
    shop_id: int,
    product_id: int,
    quantity: Decimal,
    movement_type: Literal["IN", "OUT"],
    reason: str,
    user_id: int
) -> StockMovement:
    """
    Applies a stock increase or decrease on a product row using pessimistic locking (SELECT FOR UPDATE).
    Enforces that stock can never become negative.
    Records a corresponding StockMovement entry.
    Flushes the session to stage pending SQL without committing the transaction.
    """
    # 1. Find product and acquire exclusive row lock
    product = db.scalar(
        select(Product)
        .where(
            Product.id == product_id,
            Product.shop_id == shop_id
        )
        .with_for_update()
    )

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found in this shop"
        )

    if not product.is_active:
        raise HTTPException(
            status_code=409,
            detail="Inactive products cannot have stock changed"
        )

    current_stock = Decimal(product.stock_quantity)
    quantity = Decimal(quantity)

    if quantity <= 0:
        raise HTTPException(
            status_code=422,
            detail="Quantity must be greater than zero"
        )

    # 2. Calculate new stock
    if movement_type == "IN":
        new_stock = current_stock + quantity
    elif movement_type == "OUT":
        if quantity > current_stock:
            raise HTTPException(
                status_code=409,
                detail=f"Insufficient stock available. Current stock: {current_stock}, Requested: {quantity}"
            )
        new_stock = current_stock - quantity
    else:
        raise ValueError(f"Invalid movement type: {movement_type}")

    # 3. Update product stock
    product.stock_quantity = new_stock

    # 4. Create stock movement audit record
    movement = StockMovement(
        shop_id=shop_id,
        product_id=product_id,
        movement_type=movement_type,
        quantity=quantity,
        quantity_before=current_stock,
        quantity_after=new_stock,
        reason=reason,
        created_by=user_id
    )

    db.add(movement)
    db.flush()

    return movement


def adjust_stock(
    db: Session,
    shop_id: int,
    product_id: int,
    counted_quantity: Decimal,
    reason: str,
    user_id: int
) -> StockMovement | None:
    """
    Adjusts product inventory based on a physical count.
    Automatically determines whether it's an IN or OUT movement based on the difference.
    """
    product = db.scalar(
        select(Product)
        .where(
            Product.id == product_id,
            Product.shop_id == shop_id
        )
        .with_for_update()
    )

    if product is None:
        raise HTTPException(status_code=404, detail="Product not found in this shop")

    if not product.is_active:
        raise HTTPException(status_code=409, detail="Inactive products cannot have stock changed")

    current_stock = Decimal(product.stock_quantity)
    counted = Decimal(counted_quantity)

    if counted < 0:
        raise HTTPException(status_code=422, detail="Counted stock cannot be negative")

    if counted == current_stock:
        return None  # No adjustment needed

    if counted > current_stock:
        movement_type = "IN"
        diff = counted - current_stock
    else:
        movement_type = "OUT"
        diff = current_stock - counted

    product.stock_quantity = counted

    movement = StockMovement(
        shop_id=shop_id,
        product_id=product_id,
        movement_type=movement_type,
        quantity=diff,
        quantity_before=current_stock,
        quantity_after=counted,
        reason=reason,
        created_by=user_id
    )

    db.add(movement)
    db.flush()

    return movement
