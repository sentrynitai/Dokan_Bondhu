from decimal import Decimal
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Product,
    ShopMember,
    StockMovement,
    User
)
from app.schemas.product import ProductResponse
from app.schemas.inventory import (
    InventorySummaryResponse,
    StockAdjustRequest,
    StockChangeRequest,
    StockMovementResponse
)
from app.services.inventory_service import (
    adjust_stock,
    apply_stock_change
)
from app.dependencies.auth import (
    get_current_user,
    require_shop_member,
    require_shop_role
)

router = APIRouter(
    prefix="/shops/{shop_id}",
    tags=["Inventory"]
)

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def save_stock_change(
    db: Session,
    shop_id: int,
    product_id: int,
    payload: StockChangeRequest,
    movement_type: str,
    current_user: User
) -> StockMovementResponse:
    try:
        movement = apply_stock_change(
            db=db,
            shop_id=shop_id,
            product_id=product_id,
            quantity=payload.quantity,
            movement_type=movement_type,
            reason=payload.reason,
            user_id=current_user.id
        )
        db.commit()
        db.refresh(movement)

        product = db.get(Product, product_id)
        resp = StockMovementResponse.model_validate(movement)
        resp.product_name = product.name if product else None
        return resp
    except Exception:
        db.rollback()
        raise


# 1. STOCK IN
@router.post(
    "/products/{product_id}/stock-in",
    response_model=StockMovementResponse,
    status_code=status.HTTP_201_CREATED
)
def stock_in(
    shop_id: int,
    product_id: int,
    payload: StockChangeRequest,
    db: DbSession,
    current_user: CurrentUser,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_role("owner", "manager"))
    ]
):
    """Increase stock quantity for a product."""
    return save_stock_change(
        db, shop_id, product_id, payload, "IN", current_user
    )


# 2. STOCK OUT
@router.post(
    "/products/{product_id}/stock-out",
    response_model=StockMovementResponse,
    status_code=status.HTTP_201_CREATED
)
def stock_out(
    shop_id: int,
    product_id: int,
    payload: StockChangeRequest,
    db: DbSession,
    current_user: CurrentUser,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_role("owner", "manager"))
    ]
):
    """Decrease stock quantity for a product (e.g. wastage, damage, return)."""
    return save_stock_change(
        db, shop_id, product_id, payload, "OUT", current_user
    )


# 3. STOCK ADJUSTMENT (AUDIT)
@router.post(
    "/products/{product_id}/stock-adjust",
    response_model=StockMovementResponse | None,
    status_code=status.HTTP_200_OK
)
def stock_adjust(
    shop_id: int,
    product_id: int,
    payload: StockAdjustRequest,
    db: DbSession,
    current_user: CurrentUser,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_role("owner", "manager"))
    ]
):
    """Adjust stock to a physically counted quantity, automatically logging IN or OUT movement."""
    try:
        movement = adjust_stock(
            db=db,
            shop_id=shop_id,
            product_id=product_id,
            counted_quantity=payload.counted_quantity,
            reason=payload.reason,
            user_id=current_user.id
        )
        db.commit()
        if movement is None:
            return None

        db.refresh(movement)
        product = db.get(Product, product_id)
        resp = StockMovementResponse.model_validate(movement)
        resp.product_name = product.name if product else None
        return resp
    except Exception:
        db.rollback()
        raise


# 4. PRODUCT-SPECIFIC STOCK MOVEMENTS
@router.get(
    "/products/{product_id}/stock-movements",
    response_model=list[StockMovementResponse]
)
def get_product_stock_movements(
    shop_id: int,
    product_id: int,
    db: DbSession,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_member)
    ],
    limit: int = Query(default=50, ge=1, le=200)
):
    """Retrieve stock movement ledger for an individual product."""
    product = db.scalar(
        select(Product).where(
            Product.id == product_id,
            Product.shop_id == shop_id
        )
    )
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    statement = (
        select(StockMovement)
        .where(
            StockMovement.shop_id == shop_id,
            StockMovement.product_id == product_id
        )
        .order_by(StockMovement.id.desc())
        .limit(limit)
    )
    movements = db.scalars(statement).all()

    results = []
    for m in movements:
        resp = StockMovementResponse.model_validate(m)
        resp.product_name = product.name
        results.append(resp)
    return results


# 5. ALL SHOP STOCK MOVEMENTS
@router.get(
    "/inventory/movements",
    response_model=list[StockMovementResponse]
)
def get_all_stock_movements(
    shop_id: int,
    db: DbSession,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_member)
    ],
    movement_type: str | None = Query(default=None, pattern="^(IN|OUT)$"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200)
):
    """Retrieve overall stock movements across all products in the shop."""
    statement = (
        select(StockMovement, Product.name.label("product_name"))
        .join(Product, StockMovement.product_id == Product.id)
        .where(StockMovement.shop_id == shop_id)
    )
    if movement_type:
        statement = statement.where(StockMovement.movement_type == movement_type)

    statement = statement.order_by(StockMovement.id.desc()).offset(skip).limit(limit)
    rows = db.execute(statement).all()

    results = []
    for mov, prod_name in rows:
        resp = StockMovementResponse.model_validate(mov)
        resp.product_name = prod_name
        results.append(resp)
    return results


# 6. LOW STOCK PRODUCTS
@router.get(
    "/inventory/low-stock",
    response_model=list[ProductResponse]
)
def get_low_stock_products(
    shop_id: int,
    db: DbSession,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_member)
    ]
):
    """Retrieve all products whose stock is at or below their low-stock threshold."""
    statement = (
        select(Product)
        .where(
            Product.shop_id == shop_id,
            Product.is_active.is_(True),
            Product.stock_quantity <= Product.low_stock_threshold
        )
        .order_by(Product.stock_quantity.asc())
    )
    products = db.scalars(statement).all()
    return [ProductResponse.model_validate(p) for p in products]


# 7. INVENTORY VALUATION & SUMMARY
@router.get(
    "/inventory/summary",
    response_model=InventorySummaryResponse
)
def get_inventory_summary(
    shop_id: int,
    db: DbSession,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_member)
    ]
):
    """Calculates overall stock value, retail value, product count, and low-stock count."""
    products = db.scalars(
        select(Product).where(
            Product.shop_id == shop_id,
            Product.is_active.is_(True)
        )
    ).all()

    total_products = len(products)
    total_units = Decimal("0.000")
    total_cost_val = Decimal("0.00")
    total_retail_val = Decimal("0.00")
    low_stock_count = 0
    low_stock_products = 0
    out_of_stock_products = 0

    for p in products:
        total_units += p.stock_quantity
        retail_val = p.stock_quantity * p.selling_price
        total_retail_val += retail_val

        cost = p.cost_price if p.cost_price is not None else Decimal("0.00")
        total_cost_val += p.stock_quantity * cost

        if p.stock_quantity == 0:
            out_of_stock_products += 1
            low_stock_count += 1
        elif p.stock_quantity <= p.low_stock_threshold:
            low_stock_products += 1
            low_stock_count += 1

    return InventorySummaryResponse(
        total_products=total_products,
        total_units_in_stock=total_units,
        total_stock_quantity=total_units,
        total_cost_valuation=total_cost_val,
        total_retail_valuation=total_retail_val,
        low_stock_count=low_stock_count,
        low_stock_products=low_stock_products,
        out_of_stock_products=out_of_stock_products,
        total_low_stock=low_stock_count
    )
