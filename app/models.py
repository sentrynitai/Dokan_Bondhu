from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# --------------------------------------------------
# COMMON ID TYPE
# MySQL: BIGINT UNSIGNED
# SQLite: INTEGER (supports autoincrement)
# --------------------------------------------------

def id_type():
    return BIGINT(unsigned=True).with_variant(Integer, "sqlite")


# --------------------------------------------------
# USER MODEL
# --------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )


# --------------------------------------------------
# SHOP MODEL
# --------------------------------------------------

class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    address: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )


# --------------------------------------------------
# SHOP MEMBER MODEL
# --------------------------------------------------

class ShopMember(Base):
    __tablename__ = "shop_members"

    __table_args__ = (
        CheckConstraint(
            "role IN ('owner', 'manager', 'staff')",
            name="ck_shop_member_role"
        ),
    )

    shop_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("shops.id", ondelete="CASCADE"),
        primary_key=True
    )

    user_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )


# --------------------------------------------------
# CATEGORY MODEL
# --------------------------------------------------

class Category(Base):
    __tablename__ = "categories"

    __table_args__ = (
        UniqueConstraint(
            "shop_id",
            "name",
            name="uq_categories_shop_name"
        ),
        Index(
            "ix_categories_shop_active",
            "shop_id",
            "is_active"
        ),
    )

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    description: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )


# --------------------------------------------------
# PRODUCT MODEL
# --------------------------------------------------

class Product(Base):
    __tablename__ = "products"

    __table_args__ = (
        Index(
            "ix_products_shop_is_active",
            "shop_id",
            "is_active"
        ),
        UniqueConstraint(
            "shop_id",
            "sku",
            name="uq_products_shop_sku"
        ),
    )

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False
    )

    category_id: Mapped[int | None] = mapped_column(
        id_type(),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    sku: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    image_url: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    selling_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    cost_price: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True
    )

    stock_quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
        default=Decimal("0"),
        server_default=text("0")
    )

    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pcs",
        server_default=text("'pcs'")
    )

    low_stock_threshold: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
        default=Decimal("5"),
        server_default=text("5")
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )


# --------------------------------------------------
# STOCK MOVEMENT MODEL
# --------------------------------------------------

class StockMovement(Base):
    __tablename__ = "stock_movements"

    __table_args__ = (
        CheckConstraint(
            "movement_type IN ('IN', 'OUT')",
            name="chk_movement_type"
        ),
        CheckConstraint(
            "quantity > 0",
            name="chk_movement_quantity"
        ),
        Index(
            "idx_stock_shop_product",
            "shop_id",
            "product_id"
        ),
        Index(
            "idx_stock_created_at",
            "created_at"
        )
    )

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False
    )

    product_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False
    )

    movement_type: Mapped[str] = mapped_column(
        String(3),
        nullable=False
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False
    )

    quantity_before: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False
    )

    quantity_after: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False
    )

    reason: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    created_by: Mapped[int | None] = mapped_column(
        id_type(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )


# --------------------------------------------------
# CUSTOMER MODEL
# --------------------------------------------------

class Customer(Base):
    __tablename__ = "customers"

    __table_args__ = (
        Index("idx_customers_shop_phone", "shop_id", "phone"),
        Index("idx_customers_shop_active", "shop_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    address: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    outstanding_due: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00")
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )


# --------------------------------------------------
# SUPPLIER MODEL
# --------------------------------------------------

class Supplier(Base):
    __tablename__ = "suppliers"

    __table_args__ = (
        Index("idx_suppliers_shop_active", "shop_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    contact_person: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    address: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    outstanding_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00")
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )


# --------------------------------------------------
# PURCHASE & PURCHASE ITEM MODELS
# --------------------------------------------------

class Purchase(Base):
    __tablename__ = "purchases"

    __table_args__ = (
        Index("idx_purchases_shop_date", "shop_id", "created_at"),
        UniqueConstraint("shop_id", "purchase_number", name="uq_purchases_shop_number"),
    )

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False
    )

    supplier_id: Mapped[int | None] = mapped_column(
        id_type(),
        ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True
    )

    purchase_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00")
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="COMPLETED",
        server_default=text("'COMPLETED'")
    )

    notes: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    created_by: Mapped[int | None] = mapped_column(
        id_type(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )

    items: Mapped[list["PurchaseItem"]] = relationship(
        "PurchaseItem",
        back_populates="purchase",
        cascade="all, delete-orphan"
    )


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    purchase_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("purchases.id", ondelete="CASCADE"),
        nullable=False
    )

    product_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False
    )

    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    purchase: Mapped["Purchase"] = relationship(
        "Purchase",
        back_populates="items"
    )


# --------------------------------------------------
# SALE & SALE ITEM MODELS
# --------------------------------------------------

class Sale(Base):
    __tablename__ = "sales"

    __table_args__ = (
        Index("idx_sales_shop_date", "shop_id", "created_at"),
        UniqueConstraint("shop_id", "invoice_number", name="uq_sales_shop_invoice"),
    )

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False
    )

    customer_id: Mapped[int | None] = mapped_column(
        id_type(),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True
    )

    invoice_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    discount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00")
    )

    tax: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00")
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00")
    )

    due_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00")
    )

    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="CASH",
        server_default=text("'CASH'")
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="COMPLETED",
        server_default=text("'COMPLETED'")
    )

    notes: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    created_by: Mapped[int | None] = mapped_column(
        id_type(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )

    items: Mapped[list["SaleItem"]] = relationship(
        "SaleItem",
        back_populates="sale",
        cascade="all, delete-orphan"
    )


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    sale_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("sales.id", ondelete="CASCADE"),
        nullable=False
    )

    product_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False
    )

    product_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False
    )

    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    total_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    sale: Mapped["Sale"] = relationship(
        "Sale",
        back_populates="items"
    )


# --------------------------------------------------
# PAYMENT MODEL (Customer Dues & Ledger)
# --------------------------------------------------

class Payment(Base):
    __tablename__ = "payments"

    __table_args__ = (
        Index("idx_payments_shop_date", "shop_id", "created_at"),
        Index("idx_payments_customer", "customer_id"),
    )

    id: Mapped[int] = mapped_column(
        id_type(),
        primary_key=True,
        autoincrement=True
    )

    shop_id: Mapped[int] = mapped_column(
        id_type(),
        ForeignKey("shops.id", ondelete="CASCADE"),
        nullable=False
    )

    customer_id: Mapped[int | None] = mapped_column(
        id_type(),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True
    )

    sale_id: Mapped[int | None] = mapped_column(
        id_type(),
        ForeignKey("sales.id", ondelete="SET NULL"),
        nullable=True
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False
    )

    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="CASH"
    )

    notes: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )

    created_by: Mapped[int | None] = mapped_column(
        id_type(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp()
    )
