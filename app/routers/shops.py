from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Shop, ShopMember, User
from app.schemas.shop import (
    ShopCreate,
    ShopUpdate,
    ShopResponse,
    ShopWithRoleResponse,
    ShopMemberAdd,
    ShopMemberUpdate,
    ShopMemberResponse
)
from app.dependencies.auth import (
    get_current_user,
    require_shop_member,
    require_shop_role
)

router = APIRouter(
    prefix="/shops",
    tags=["Shops & Members"]
)

DbSession = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# 1. LIST SHOPS FOR CURRENT USER
@router.get("", response_model=list[ShopWithRoleResponse])
def get_my_shops(
    current_user: CurrentUser,
    db: DbSession
):
    """List all shops that the authenticated user is a member of, along with their role."""
    statement = (
        select(Shop, ShopMember.role)
        .join(ShopMember, Shop.id == ShopMember.shop_id)
        .where(ShopMember.user_id == current_user.id)
        .order_by(Shop.id.asc())
    )
    rows = db.execute(statement).all()

    return [
        ShopWithRoleResponse(
            id=shop.id,
            name=shop.name,
            phone=shop.phone,
            address=shop.address,
            role=role,
            created_at=shop.created_at
        )
        for shop, role in rows
    ]


# 2. CREATE A NEW SHOP
@router.post("", response_model=ShopWithRoleResponse, status_code=status.HTTP_201_CREATED)
def create_shop(
    payload: ShopCreate,
    current_user: CurrentUser,
    db: DbSession
):
    """Create a new shop and automatically assign the creator as the 'owner'."""
    new_shop = Shop(
        name=payload.name.strip(),
        phone=payload.phone.strip() if payload.phone else None,
        address=payload.address.strip() if payload.address else None
    )
    db.add(new_shop)
    db.flush()

    membership = ShopMember(
        shop_id=new_shop.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(membership)
    db.commit()
    db.refresh(new_shop)

    return ShopWithRoleResponse(
        id=new_shop.id,
        name=new_shop.name,
        phone=new_shop.phone,
        address=new_shop.address,
        role="owner",
        created_at=new_shop.created_at
    )


# 3. GET SINGLE SHOP DETAILS
@router.get("/{shop_id}", response_model=ShopWithRoleResponse)
def get_shop_profile(
    shop_id: int,
    membership: Annotated[ShopMember, Depends(require_shop_member)],
    db: DbSession
):
    """Retrieve details for a specific shop. Requires membership in the shop."""
    shop = db.get(Shop, shop_id)
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")

    return ShopWithRoleResponse(
        id=shop.id,
        name=shop.name,
        phone=shop.phone,
        address=shop.address,
        role=membership.role,
        created_at=shop.created_at
    )


# 4. UPDATE SHOP PROFILE
@router.patch("/{shop_id}", response_model=ShopResponse)
def update_shop_profile(
    shop_id: int,
    payload: ShopUpdate,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner"))],
    db: DbSession
):
    """Update shop information. Restricted to shop owner."""
    shop = db.get(Shop, shop_id)
    if shop is None:
        raise HTTPException(status_code=404, detail="Shop not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None and isinstance(val, str):
            val = val.strip()
        setattr(shop, field, val)

    db.commit()
    db.refresh(shop)
    return shop


# 5. LIST MEMBERS OF A SHOP
@router.get("/{shop_id}/members", response_model=list[ShopMemberResponse])
def get_shop_members(
    shop_id: int,
    membership: Annotated[ShopMember, Depends(require_shop_member)],
    db: DbSession
):
    """List all members of the shop with their roles and user information."""
    statement = (
        select(ShopMember, User.full_name, User.email)
        .join(User, ShopMember.user_id == User.id)
        .where(ShopMember.shop_id == shop_id)
        .order_by(ShopMember.created_at.asc())
    )
    rows = db.execute(statement).all()

    return [
        ShopMemberResponse(
            shop_id=member.shop_id,
            user_id=member.user_id,
            role=member.role,
            user_name=full_name,
            user_email=email,
            created_at=member.created_at
        )
        for member, full_name, email in rows
    ]


# 6. ADD MEMBER TO SHOP
@router.post("/{shop_id}/members", response_model=ShopMemberResponse, status_code=status.HTTP_201_CREATED)
def add_shop_member(
    shop_id: int,
    payload: ShopMemberAdd,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner", "manager"))],
    db: DbSession
):
    """Add an existing registered user to the shop as manager or staff."""
    target_email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == target_email))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found with email '{target_email}'. User must register first."
        )

    # Check if already a member
    existing_member = db.get(ShopMember, (shop_id, user.id))
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this shop"
        )

    new_membership = ShopMember(
        shop_id=shop_id,
        user_id=user.id,
        role=payload.role
    )
    db.add(new_membership)
    db.commit()
    db.refresh(new_membership)

    return ShopMemberResponse(
        shop_id=new_membership.shop_id,
        user_id=new_membership.user_id,
        role=new_membership.role,
        user_name=user.full_name,
        user_email=user.email,
        created_at=new_membership.created_at
    )


# 7. UPDATE MEMBER ROLE
@router.patch("/{shop_id}/members/{user_id}", response_model=ShopMemberResponse)
def update_shop_member_role(
    shop_id: int,
    user_id: int,
    payload: ShopMemberUpdate,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner"))],
    db: DbSession
):
    """Change the role of a shop member. Restricted to shop owner."""
    target_member = db.get(ShopMember, (shop_id, user_id))
    if target_member is None:
        raise HTTPException(status_code=404, detail="Shop member not found")

    user = db.get(User, user_id)
    target_member.role = payload.role
    db.commit()
    db.refresh(target_member)

    return ShopMemberResponse(
        shop_id=target_member.shop_id,
        user_id=target_member.user_id,
        role=target_member.role,
        user_name=user.full_name,
        user_email=user.email,
        created_at=target_member.created_at
    )


# 8. REMOVE MEMBER FROM SHOP
@router.delete("/{shop_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_shop_member(
    shop_id: int,
    user_id: int,
    membership: Annotated[ShopMember, Depends(require_shop_role("owner"))],
    db: DbSession
):
    """Remove a member from the shop. Restricted to owner. Cannot remove self."""
    if membership.user_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owner cannot remove themselves from their shop"
        )

    target_member = db.get(ShopMember, (shop_id, user_id))
    if target_member is None:
        raise HTTPException(status_code=404, detail="Shop member not found")

    db.delete(target_member)
    db.commit()
