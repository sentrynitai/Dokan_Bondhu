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
from app.models import Customer, Payment, ShopMember, User
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import record_customer_payment
from app.dependencies.auth import (
    get_current_user,
    require_shop_member
)

router = APIRouter(
    prefix="/shops/{shop_id}/payments",
    tags=["Payments & Customer Dues"]
)

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


def format_payment_response(db: Session, payment: Payment) -> PaymentResponse:
    customer_name = None
    if payment.customer_id:
        cust = db.get(Customer, payment.customer_id)
        if cust:
            customer_name = cust.name

    return PaymentResponse(
        id=payment.id,
        shop_id=payment.shop_id,
        customer_id=payment.customer_id,
        customer_name=customer_name,
        sale_id=payment.sale_id,
        amount=payment.amount,
        payment_method=payment.payment_method,
        notes=payment.notes,
        created_at=payment.created_at
    )


# 1. RECORD CUSTOMER PAYMENT
@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def make_payment(
    shop_id: int,
    payload: PaymentCreate,
    db: DbSession,
    current_user: CurrentUser,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Record customer repayment towards their outstanding khata due."""
    payment = record_customer_payment(
        db=db,
        shop_id=shop_id,
        payload=payload,
        user_id=current_user.id
    )
    return format_payment_response(db, payment)


# 2. LIST PAYMENTS
@router.get("", response_model=list[PaymentResponse])
def get_payments(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)],
    customer_id: int | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100)
):
    """List payment transactions history."""
    stmt = select(Payment).where(Payment.shop_id == shop_id)
    if customer_id:
        stmt = stmt.where(Payment.customer_id == customer_id)
    stmt = stmt.order_by(Payment.id.desc()).offset(skip).limit(limit)

    payments = db.scalars(stmt).all()
    return [format_payment_response(db, p) for p in payments]
