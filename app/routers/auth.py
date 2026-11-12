
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status
)

from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import User, Shop, ShopMember

from app.auth_schemas import (
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse
)

from app.core.security import (
    hash_password,
    verify_password,
    create_access_token
)

from app.dependencies.auth import get_current_user


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

DbSession = Annotated[Session, Depends(get_db)]


# REGISTER
@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED
)
def register_user(
    payload: RegisterRequest,
    db: DbSession
):

    email = str(payload.email).lower()

    # Check whether email already exists
    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    # Create user with hashed password
    user = User(
        full_name=payload.full_name,
        email=email,
        password_hash=hash_password(payload.password)
    )

    try:

        db.add(user)
        db.flush()

        # Create the shop
        shop = Shop(
            name=payload.shop_name,
            phone=payload.phone,
            address=payload.address
        )

        db.add(shop)
        db.flush()

        # Connect user and shop
        membership = ShopMember(
            shop_id=shop.id,
            user_id=user.id,
            role="owner"
        )

        db.add(membership)

        # Save everything together
        db.commit()

        db.refresh(user)
        db.refresh(shop)

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Registration conflict. Check the email and shop data."
        )

    return RegisterResponse(
        message="Registration successful",
        user_id=user.id,
        shop_id=shop.id
    )


# LOGIN
@router.post(
    "/login",
    response_model=TokenResponse
)
def login_user(
    form_data: Annotated[
        OAuth2PasswordRequestForm,
        Depends()
    ],
    db: DbSession
):

    email = form_data.username.strip().lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    # Verify credentials
    if (
        user is None
        or not verify_password(
            form_data.password,
            user.password_hash
        )
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Generate token
    access_token = create_access_token(user.id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer"
    )


# GET CURRENT USER
@router.get(
    "/me",
    response_model=UserResponse
)
def get_my_profile(
    current_user: Annotated[
        User,
        Depends(get_current_user)
    ]
):

    return current_user


# LOGOUT
@router.post(
    "/logout",
    status_code=status.HTTP_200_OK
)
def logout_user():
    """Stateless logout confirmation. Client clears local JWT token."""
    return {"message": "Logged out successfully"}

