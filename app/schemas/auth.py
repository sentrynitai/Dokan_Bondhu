from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator
)


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    shop_name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = Field(default=None, max_length=255)

    @field_validator("full_name", "shop_name")
    @classmethod
    def clean_text(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be empty")
        return value


class RegisterResponse(BaseModel):
    message: str
    user_id: int
    shop_id: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr

    model_config = ConfigDict(from_attributes=True)
