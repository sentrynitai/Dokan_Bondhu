from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, Purchase, ShopMember, Supplier, User
from app.schemas.purchase import (
    PurchaseCreate,
    PurchaseItemResponse,
    PurchaseResponse
)
from app.services.purchase_service import create_purchase_transaction
from app.dependencies.auth import (
    get_current_user,
    require_shop_member,
    require_shop_role
)

router = APIRouter(
    prefix="/shops/{shop_id}/purchases",
    tags=["Purchases"]
)

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def format_purchase_response(db: Session, purchase: Purchase) -> PurchaseResponse:
    supplier_name = None
    if purchase.supplier_id:
        supp = db.get(Supplier, purchase.supplier_id)
        if supp:
            supplier_name = supp.name

    items_res = []
    for item in purchase.items:
        prod = db.get(Product, item.product_id)
        items_res.append(
            PurchaseItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=prod.name if prod else None,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                total_cost=item.total_cost
            )
        )

    return PurchaseResponse(
        id=purchase.id,
        shop_id=purchase.shop_id,
        supplier_id=purchase.supplier_id,
        supplier_name=supplier_name,
        purchase_number=purchase.purchase_number,
        total_amount=purchase.total_amount,
        paid_amount=purchase.paid_amount,
        status=purchase.status,
        notes=purchase.notes,
        created_at=purchase.created_at,
        items=items_res
    )


# 1. CREATE PURCHASE
@router.post("", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(
    shop_id: int,
    payload: PurchaseCreate,
    db: DbSession,
    current_user: CurrentUser,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner", "manager"))]
):
    """Record a purchase order from a supplier, updating inventory and supplier dues atomically."""
    purchase = create_purchase_transaction(
        db=db,
        shop_id=shop_id,
        payload=payload,
        user_id=current_user.id
    )
    return format_purchase_response(db, purchase)


# 2. LIST PURCHASES
@router.get("", response_model=list[PurchaseResponse])
def get_purchases(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)],
    supplier_id: int | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100)
):
    """List purchase history for the shop."""
    stmt = select(Purchase).where(Purchase.shop_id == shop_id)
    if supplier_id:
        stmt = stmt.where(Purchase.supplier_id == supplier_id)
    stmt = stmt.order_by(Purchase.id.desc()).offset(skip).limit(limit)

    purchases = db.scalars(stmt).all()
    return [format_purchase_response(db, p) for p in purchases]


# 3. GET SINGLE PURCHASE
@router.get("/{purchase_id}", response_model=PurchaseResponse)
def get_single_purchase(
    shop_id: int,
    purchase_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Get single purchase details and item breakdown."""
    purchase = db.scalar(
        select(Purchase).where(
            Purchase.id == purchase_id,
            Purchase.shop_id == shop_id
        )
    )
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    return format_purchase_response(db, purchase)
