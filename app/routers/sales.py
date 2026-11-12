from datetime import datetime
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
from app.models import Customer, Sale, Shop, ShopMember, User
from app.schemas.sale import (
    ReceiptCustomerInfo,
    ReceiptResponse,
    ReceiptShopInfo,
    SaleCreate,
    SaleItemResponse,
    SaleResponse
)
from app.services.sales_service import create_sale_transaction
from app.dependencies.auth import (
    get_current_user,
    require_shop_member
)

router = APIRouter(
    prefix="/shops/{shop_id}/sales",
    tags=["Sales & Billing"]
)

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def format_sale_response(db: Session, sale: Sale) -> SaleResponse:
    customer_name = None
    if sale.customer_id:
        cust = db.get(Customer, sale.customer_id)
        if cust:
            customer_name = cust.name

    items_res = [
        SaleItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product_name,
            unit=item.unit,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price
        )
        for item in sale.items
    ]

    return SaleResponse(
        id=sale.id,
        shop_id=sale.shop_id,
        customer_id=sale.customer_id,
        customer_name=customer_name,
        invoice_number=sale.invoice_number,
        subtotal=sale.subtotal,
        discount=sale.discount,
        tax=sale.tax,
        total_amount=sale.total_amount,
        paid_amount=sale.paid_amount,
        due_amount=sale.due_amount,
        payment_method=sale.payment_method,
        status=sale.status,
        notes=sale.notes,
        created_at=sale.created_at,
        items=items_res
    )


# 1. CREATE POS SALE
@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    shop_id: int,
    payload: SaleCreate,
    db: DbSession,
    current_user: CurrentUser,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """
    Checkout and complete a sale.
    Validates stock, locks product rows, deducts inventory, records stock movements,
    calculates totals, and updates customer dues in one atomic transaction.
    """
    sale = create_sale_transaction(
        db=db,
        shop_id=shop_id,
        payload=payload,
        user_id=current_user.id
    )
    return format_sale_response(db, sale)


# 2. LIST SALES
@router.get("", response_model=list[SaleResponse])
def get_sales(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)],
    customer_id: int | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100)
):
    """Retrieve list of sales history for the shop."""
    stmt = select(Sale).where(Sale.shop_id == shop_id)
    if customer_id:
        stmt = stmt.where(Sale.customer_id == customer_id)
    if payment_method:
        stmt = stmt.where(Sale.payment_method == payment_method)

    stmt = stmt.order_by(Sale.id.desc()).offset(skip).limit(limit)
    sales = db.scalars(stmt).all()
    return [format_sale_response(db, s) for s in sales]


# 3. GET SINGLE SALE
@router.get("/{sale_id}", response_model=SaleResponse)
def get_single_sale(
    shop_id: int,
    sale_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Get single sale invoice and item breakdown."""
    sale = db.scalar(
        select(Sale).where(
            Sale.id == sale_id,
            Sale.shop_id == shop_id
        )
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    return format_sale_response(db, sale)


# 4. GET PRINTABLE RECEIPT
@router.get("/{sale_id}/receipt", response_model=ReceiptResponse)
def get_sale_receipt(
    shop_id: int,
    sale_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Generates structured printable/thermal receipt data."""
    sale = db.scalar(
        select(Sale).where(
            Sale.id == sale_id,
            Sale.shop_id == shop_id
        )
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Sale invoice not found")

    shop = db.get(Shop, shop_id)
    cust_info = None
    if sale.customer_id:
        customer = db.get(Customer, sale.customer_id)
        if customer:
            cust_info = ReceiptCustomerInfo(
                name=customer.name,
                phone=customer.phone,
                current_due=customer.outstanding_due
            )

    items_res = [
        SaleItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product_name,
            unit=item.unit,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price
        )
        for item in sale.items
    ]

    return ReceiptResponse(
        invoice_number=sale.invoice_number,
        date=sale.created_at,
        shop=ReceiptShopInfo(
            name=shop.name,
            phone=shop.phone,
            address=shop.address
        ),
        customer=cust_info,
        items=items_res,
        subtotal=sale.subtotal,
        discount=sale.discount,
        tax=sale.tax,
        total_amount=sale.total_amount,
        paid_amount=sale.paid_amount,
        due_amount=sale.due_amount,
        payment_method=sale.payment_method,
        notes=sale.notes
    )
