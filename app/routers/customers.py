from decimal import Decimal
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    status
)
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer, Payment, Sale, ShopMember
from app.schemas.customer import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate
)
from app.dependencies.auth import (
    require_shop_member,
    require_shop_role
)

router = APIRouter(
    prefix="/shops/{shop_id}/customers",
    tags=["Customers"]
)

DbSession = Annotated[Session, Depends(get_db)]


def get_customer_or_404(
    db: Session,
    shop_id: int,
    customer_id: int,
    include_inactive: bool = False
) -> Customer:
    stmt = select(Customer).where(
        Customer.id == customer_id,
        Customer.shop_id == shop_id
    )
    if not include_inactive:
        stmt = stmt.where(Customer.is_active.is_(True))

    customer = db.scalar(stmt)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found in this shop"
        )
    return customer


# 1. CREATE CUSTOMER
@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    shop_id: int,
    payload: CustomerCreate,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Add a customer to the shop khata / directory."""
    customer = Customer(
        shop_id=shop_id,
        name=payload.name.strip(),
        phone=payload.phone.strip() if payload.phone else None,
        email=str(payload.email).lower() if payload.email else None,
        address=payload.address.strip() if payload.address else None,
        outstanding_due=payload.initial_due,
        is_active=True
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


# 2. LIST CUSTOMERS WITH SEARCH & DUE FILTER
@router.get("", response_model=list[CustomerResponse])
def get_customers(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)],
    search: str | None = Query(default=None, description="Search by name or phone"),
    with_dues_only: bool = Query(default=False, description="Filter only customers with outstanding balance"),
    include_inactive: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100)
):
    """List shop customers with search by name or phone, or filter by pending dues."""
    stmt = select(Customer).where(Customer.shop_id == shop_id)

    if not include_inactive:
        stmt = stmt.where(Customer.is_active.is_(True))

    if with_dues_only:
        stmt = stmt.where(Customer.outstanding_due > Decimal("0.00"))

    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Customer.name.ilike(pattern),
                Customer.phone.ilike(pattern)
            )
        )

    stmt = stmt.order_by(Customer.name.asc()).offset(skip).limit(limit)
    return db.scalars(stmt).all()


# 3. GET SINGLE CUSTOMER
@router.get("/{customer_id}", response_model=CustomerResponse)
def get_single_customer(
    shop_id: int,
    customer_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Get single customer profile."""
    return get_customer_or_404(db, shop_id, customer_id, include_inactive=True)


# 4. UPDATE CUSTOMER
@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    shop_id: int,
    customer_id: int,
    payload: CustomerUpdate,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Update customer details."""
    customer = get_customer_or_404(db, shop_id, customer_id, include_inactive=True)
    update_data = payload.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No update fields provided")

    for field, val in update_data.items():
        if isinstance(val, str):
            val = val.strip()
        setattr(customer, field, val)

    db.commit()
    db.refresh(customer)
    return customer


# 5. DELETE CUSTOMER (SOFT DELETE)
@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    shop_id: int,
    customer_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner", "manager"))]
):
    """Soft delete customer."""
    customer = get_customer_or_404(db, shop_id, customer_id)
    customer.is_active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# 6. GET CUSTOMER LEDGER / HISTORY
@router.get("/{customer_id}/ledger")
def get_customer_ledger(
    shop_id: int,
    customer_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Retrieve full transaction ledger (invoices and payments) for this customer."""
    customer = get_customer_or_404(db, shop_id, customer_id, include_inactive=True)

    # Fetch Sales
    sales_stmt = (
        select(Sale)
        .where(
            Sale.shop_id == shop_id,
            Sale.customer_id == customer_id
        )
        .order_by(Sale.created_at.desc())
        .limit(50)
    )
    sales = db.scalars(sales_stmt).all()

    # Fetch Payments
    payments_stmt = (
        select(Payment)
        .where(
            Payment.shop_id == shop_id,
            Payment.customer_id == customer_id
        )
        .order_by(Payment.created_at.desc())
        .limit(50)
    )
    payments = db.scalars(payments_stmt).all()

    return {
        "customer": CustomerResponse.model_validate(customer),
        "outstanding_due": customer.outstanding_due,
        "sales": [
            {
                "id": s.id,
                "invoice_number": s.invoice_number,
                "total_amount": s.total_amount,
                "paid_amount": s.paid_amount,
                "due_amount": s.due_amount,
                "payment_method": s.payment_method,
                "created_at": s.created_at
            }
            for s in sales
        ],
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "payment_method": p.payment_method,
                "notes": p.notes,
                "created_at": p.created_at
            }
            for p in payments
        ]
    }
