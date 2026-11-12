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
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Product, ShopMember, StockMovement, User
from app.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductUpdate
)
from app.schemas.inventory import StockUpdateRequest
from app.services.inventory_service import apply_stock_change
from app.dependencies.auth import (
    get_current_user,
    require_shop_member,
    require_shop_role
)

router = APIRouter(
    prefix="/shops/{shop_id}/products",
    tags=["Products"]
)

DbSession = Annotated[Session, Depends(get_db)]


def get_product_or_404(
    db: Session,
    shop_id: int,
    product_id: int,
    include_inactive: bool = False
) -> Product:
    statement = select(Product).where(
        Product.id == product_id,
        Product.shop_id == shop_id
    )
    if not include_inactive:
        statement = statement.where(Product.is_active.is_(True))

    product = db.scalar(statement)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    return product


def build_product_response(product: Product, category_name: str | None = None) -> ProductResponse:
    resp = ProductResponse.model_validate(product)
    resp.category_name = category_name
    return resp


# 1. CREATE PRODUCT (WITH OPENING STOCK AUDIT)
@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED
)
def create_product(
    shop_id: int,
    payload: ProductCreate,
    db: DbSession,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_role("owner", "manager"))
    ]
):
    """Create a new product. If opening stock > 0, an initial Stock In movement is automatically created."""
    # If category_id is specified, verify it belongs to this shop
    category_name = None
    if payload.category_id:
        category = db.scalar(
            select(Category).where(
                Category.id == payload.category_id,
                Category.shop_id == shop_id
            )
        )
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category not found in this shop"
            )
        category_name = category.name

    new_product = Product(
        shop_id=shop_id,
        category_id=payload.category_id,
        name=payload.name.strip(),
        sku=payload.sku.strip() if payload.sku else None,
        description=payload.description.strip() if payload.description else None,
        image_url=payload.image_url.strip() if payload.image_url else None,
        selling_price=payload.selling_price,
        cost_price=payload.cost_price,
        stock_quantity=payload.stock_quantity,
        unit=payload.unit.strip(),
        low_stock_threshold=payload.low_stock_threshold,
        is_active=True
    )

    db.add(new_product)

    try:
        db.flush()

        # If opening stock is greater than 0, record opening stock movement
        if payload.stock_quantity > 0:
            opening_movement = StockMovement(
                shop_id=shop_id,
                product_id=new_product.id,
                movement_type="IN",
                quantity=payload.stock_quantity,
                quantity_before=Decimal("0.000"),
                quantity_after=payload.stock_quantity,
                reason="Opening Stock",
                created_by=membership.user_id
            )
            db.add(opening_movement)

        db.commit()
        db.refresh(new_product)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create product. SKU may already exist for this shop."
        )

    return build_product_response(new_product, category_name)


# 2. READ PRODUCTS WITH SEARCH & FILTER
@router.get("", response_model=list[ProductResponse])
def get_products(
    shop_id: int,
    db: DbSession,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_member)
    ],
    search: str | None = Query(default=None, description="Search by product name or SKU"),
    category_id: int | None = Query(default=None, description="Filter by category"),
    include_inactive: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100)
):
    """List products with optional search query, category filter, and pagination."""
    statement = (
        select(Product, Category.name.label("category_name"))
        .outerjoin(Category, Product.category_id == Category.id)
        .where(Product.shop_id == shop_id)
    )

    if not include_inactive:
        statement = statement.where(Product.is_active.is_(True))

    if category_id:
        statement = statement.where(Product.category_id == category_id)

    if search:
        search_pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Product.name.ilike(search_pattern),
                Product.sku.ilike(search_pattern)
            )
        )

    statement = statement.order_by(Product.name.asc()).offset(skip).limit(limit)
    results = db.execute(statement).all()

    return [
        build_product_response(prod, cat_name)
        for prod, cat_name in results
    ]


# 3. READ SINGLE PRODUCT
@router.get("/{product_id}", response_model=ProductResponse)
def get_single_product(
    shop_id: int,
    product_id: int,
    db: DbSession,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_member)
    ]
):
    """Get single product details."""
    product = get_product_or_404(
        db=db,
        shop_id=shop_id,
        product_id=product_id,
        include_inactive=True
    )
    category_name = None
    if product.category_id:
        category = db.get(Category, product.category_id)
        if category:
            category_name = category.name

    return build_product_response(product, category_name)


# 4. UPDATE PRODUCT
@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    shop_id: int,
    product_id: int,
    payload: ProductUpdate,
    db: DbSession,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_role("owner", "manager"))
    ]
):
    """Update product details. Changing stock quantity directly is blocked (use inventory endpoints)."""
    product = get_product_or_404(
        db=db,
        shop_id=shop_id,
        product_id=product_id,
        include_inactive=True
    )

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No update fields provided"
        )

    # If updating category_id, verify it belongs to this shop
    if "category_id" in update_data and update_data["category_id"] is not None:
        category = db.scalar(
            select(Category).where(
                Category.id == update_data["category_id"],
                Category.shop_id == shop_id
            )
        )
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category not found in this shop"
            )

    for field, value in update_data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(product, field, value)

    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not update product. SKU may already exist for this shop."
        )

    category_name = None
    if product.category_id:
        cat = db.get(Category, product.category_id)
        if cat:
            category_name = cat.name

    return build_product_response(product, category_name)


# 5. UPDATE PRODUCT STOCK (INCREASE OR DECREASE)
@router.post("/{product_id}/stock", response_model=ProductResponse)
def update_product_stock(
    shop_id: int,
    product_id: int,
    payload: StockUpdateRequest,
    db: DbSession,
    current_user: Annotated[User, Depends(get_current_user)],
    membership: Annotated[
        ShopMember,
        Depends(require_shop_role("owner", "manager"))
    ]
):
    """
    Directly update stock quantity: Increase (Stock In) or Decrease (Stock Out).
    Enforces non-negative stock and records an audit movement.
    """
    movement_type = "IN" if payload.action in ["increase", "IN"] else "OUT"
    default_reason = "Manual Stock Increase" if movement_type == "IN" else "Manual Stock Decrease"
    reason = payload.reason.strip() if payload.reason and payload.reason.strip() else default_reason

    try:
        apply_stock_change(
            db=db,
            shop_id=shop_id,
            product_id=product_id,
            quantity=payload.quantity,
            movement_type=movement_type,
            reason=reason,
            user_id=current_user.id
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    product = get_product_or_404(db=db, shop_id=shop_id, product_id=product_id)
    category_name = None
    if product.category_id:
        cat = db.get(Category, product.category_id)
        if cat:
            category_name = cat.name

    return build_product_response(product, category_name)


# 6. DELETE PRODUCT (SOFT DELETE)
@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    shop_id: int,
    product_id: int,
    db: DbSession,
    membership: Annotated[
        ShopMember,
        Depends(require_shop_role("owner", "manager"))
    ]
):
    """Soft-delete product by marking is_active = False."""
    product = get_product_or_404(
        db=db,
        shop_id=shop_id,
        product_id=product_id
    )

    try:
        product.is_active = False
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete product"
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
