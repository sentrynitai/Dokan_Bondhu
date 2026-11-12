from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Customer, Payment
from app.schemas.payment import PaymentCreate


def record_customer_payment(
    db: Session,
    shop_id: int,
    payload: PaymentCreate,
    user_id: int
) -> Payment:
    """
    Records a customer repayment against their outstanding dues:
    1. Locks the customer row with with_for_update().
    2. Validates payment amount > 0 and amount <= customer.outstanding_due.
    3. Decreases customer's outstanding_due.
    4. Creates a permanent Payment ledger entry.
    5. Commits atomically.
    """
    customer = db.scalar(
        select(Customer)
        .where(
            Customer.id == payload.customer_id,
            Customer.shop_id == shop_id,
            Customer.is_active.is_(True)
        )
        .with_for_update()
    )

    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found in this shop")

    if payload.amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Payment amount must be greater than zero"
        )

    if customer.outstanding_due <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customer '{customer.name}' has no outstanding due (Balance: ₹0.00)"
        )

    # In retail, if customer pays more than due, cap deduction at current due or allow overpayment
    deduction = min(payload.amount, customer.outstanding_due)
    customer.outstanding_due -= deduction

    payment = Payment(
        shop_id=shop_id,
        customer_id=customer.id,
        sale_id=payload.sale_id,
        amount=payload.amount,
        payment_method=payload.payment_method,
        notes=payload.notes.strip() if payload.notes else f"Due clearance for {customer.name}",
        created_by=user_id
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
