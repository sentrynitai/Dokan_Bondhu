from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, ShopMember
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse
)
from app.dependencies.auth import (
    require_shop_member,
    require_shop_role
)

router = APIRouter(
    prefix="/shops/{shop_id}/categories",
    tags=["Categories"]
)

DbSession = Annotated[Session, Depends(get_db)]


def get_category_or_404(
    db: Session,
    shop_id: int,
    category_id: int,
    include_inactive: bool = False
) -> Category:
    stmt = select(Category).where(
        Category.id == category_id,
        Category.shop_id == shop_id
    )
    if not include_inactive:
        stmt = stmt.where(Category.is_active.is_(True))

    cat = db.scalar(stmt)
    if cat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    return cat


# 1. CREATE CATEGORY
@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    shop_id: int,
    payload: CategoryCreate,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner", "manager"))]
):
    """Create a new product category for this shop."""
    category = Category(
        shop_id=shop_id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None
    )
    db.add(category)
    try:
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category '{payload.name}' already exists in this shop"
        )

    return category


# 2. LIST CATEGORIES
@router.get("", response_model=list[CategoryResponse])
def get_categories(
    shop_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)],
    include_inactive: bool = Query(default=False)
):
    """List all categories for the shop."""
    stmt = select(Category).where(Category.shop_id == shop_id)
    if not include_inactive:
        stmt = stmt.where(Category.is_active.is_(True))
    stmt = stmt.order_by(Category.name.asc())

    return db.scalars(stmt).all()


# 3. GET SINGLE CATEGORY
@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    shop_id: int,
    category_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_member)]
):
    """Get category details."""
    return get_category_or_404(db, shop_id, category_id, include_inactive=True)


# 4. UPDATE CATEGORY
@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    shop_id: int,
    category_id: int,
    payload: CategoryUpdate,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner", "manager"))]
):
    """Update category details or toggle active status."""
    category = get_category_or_404(db, shop_id, category_id, include_inactive=True)
    update_data = payload.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    for field, val in update_data.items():
        if isinstance(val, str):
            val = val.strip()
        setattr(category, field, val)

    try:
        db.commit()
        db.refresh(category)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists in this shop"
        )

    return category


# 5. DELETE CATEGORY (SOFT DELETE)
@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    shop_id: int,
    category_id: int,
    db: DbSession,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner", "manager"))]
):
    """Archive (soft-delete) category."""
    category = get_category_or_404(db, shop_id, category_id)
    category.is_active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
