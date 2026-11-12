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
from app.models import Purchase, ShopMember, Supplier
from app.schemas.supplier import (
    SupplierCreate,
    SupplierResponse,
    SupplierUpdate
)
from app.dependencies.auth import (
    require_shop_member,
    require_shop_role
)

router = APIRouter(
    prefix="/shops/{shop_id}/suppliers",
    tags=["Suppliers"]
)

DbSession = Annotated[Session, Depends(get_db)]


def get_supplier_or_404(
    db: Session,
    shop_id: int,
    supplier_id: int,
    include_inactive: bool = False
) -> Supplier:
    stmt = select(Supplier).where(
        Supplier.id == supplier_id,
        Supplier.shop_id == shop_id
    )
    if not include_inactive:
        stmt = stmt.where(Supplier.is_active.is_(True))

    supplier = db.scalar(stmt)
    if supplier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found in this shop"
        )
    return supplier


# 1. CREATE SUPPLIER
@router.post("", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    shop_id: int,
    payload: SupplierCreate,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner", "manager"))]
):
    """Add a new supplier / vendor to the shop."""
    supplier = Supplier(
        shop_id=shop_id,
        name=payload.name.strip(),
        contact_person=payload.contact_person.strip() if payload.contact_person else None,
        phone=payload.phone.strip() if payload.phone else None,
        email=str(payload.email).lower() if payload.email else None,
        address=payload.address.strip() if payload.address else None,
        outstanding_balance=payload.initial_balance,
        is_active=True
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


# 2. LIST SUPPLIERS WITH SEARCH
@router.get("", response_model=list[SupplierResponse])
def get_suppliers(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)],
    search: str | None = Query(default=None, description="Search by name, contact person, or phone"),
    include_inactive: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100)
):
    """List shop suppliers with search and pagination."""
    stmt = select(Supplier).where(Supplier.shop_id == shop_id)

    if not include_inactive:
        stmt = stmt.where(Supplier.is_active.is_(True))

    if search:
        pat = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Supplier.name.ilike(pat),
                Supplier.contact_person.ilike(pat),
                Supplier.phone.ilike(pat)
            )
        )

    stmt = stmt.order_by(Supplier.name.asc()).offset(skip).limit(limit)
    return db.scalars(stmt).all()


# 3. GET SINGLE SUPPLIER
@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_single_supplier(
    shop_id: int,
    supplier_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Get single supplier profile."""
    return get_supplier_or_404(db, shop_id, supplier_id, include_inactive=True)


# 4. UPDATE SUPPLIER
@router.patch("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    shop_id: int,
    supplier_id: int,
    payload: SupplierUpdate,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner", "manager"))]
):
    """Update supplier information."""
    supplier = get_supplier_or_404(db, shop_id, supplier_id, include_inactive=True)
    update_data = payload.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    for field, val in update_data.items():
        if isinstance(val, str):
            val = val.strip()
        setattr(supplier, field, val)

    db.commit()
    db.refresh(supplier)
    return supplier


# 5. DELETE SUPPLIER (SOFT DELETE)
@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    shop_id: int,
    supplier_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner", "manager"))]
):
    """Soft delete supplier."""
    supplier = get_supplier_or_404(db, shop_id, supplier_id)
    supplier.is_active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# 6. GET SUPPLIER PURCHASE HISTORY
@router.get("/{supplier_id}/purchases")
def get_supplier_purchases(
    shop_id: int,
    supplier_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """List purchase orders associated with this supplier."""
    supplier = get_supplier_or_404(db, shop_id, supplier_id, include_inactive=True)
    stmt = (
        select(Purchase)
        .where(
            Purchase.shop_id == shop_id,
            Purchase.supplier_id == supplier_id
        )
        .order_by(Purchase.created_at.desc())
        .limit(50)
    )
    purchases = db.scalars(stmt).all()
    return [
        {
            "id": p.id,
            "purchase_number": p.purchase_number,
            "total_amount": p.total_amount,
            "paid_amount": p.paid_amount,
            "status": p.status,
            "notes": p.notes,
            "created_at": p.created_at
        }
        for p in purchases
    ]
