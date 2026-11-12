from typing import Annotated

import jwt

from jwt.exceptions import InvalidTokenError

from fastapi import (
    Depends,
    HTTPException,
    status
)

from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, ShopMember

from app.core.security import (
    SECRET_KEY,
    ALGORITHM,
    oauth2_scheme
)


DbSession = Annotated[
    Session,
    Depends(get_db)
]


# Authentication dependency
def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DbSession
):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub"]}
        )

        user_id = int(payload["sub"])

    except (InvalidTokenError, TypeError, ValueError):

        raise credentials_exception

    user = db.get(User, user_id)

    if user is None:
        raise credentials_exception

    return user


# Authorization dependency
def require_shop_member(
    shop_id: int,
    current_user: Annotated[
        User,
        Depends(get_current_user)
    ],
    db: DbSession
):

    membership = db.get(
        ShopMember,
        (shop_id, current_user.id)
    )

    if membership is None:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this shop"
        )

    return membership


# Role-based authorization
def require_shop_role(*allowed_roles):

    def check_role(
        membership: Annotated[
            ShopMember,
            Depends(require_shop_member)
        ]
    ):

        if membership.role not in allowed_roles:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission for this operation"
            )

        return membership

    return check_role