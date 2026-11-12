import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from tests.test_shops import register_and_login


def test_category_crud_and_isolation(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "catowner@test.com", "Cat Owner", "Category Shop")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Category
    res = client.post(f"/shops/{shop_id}/categories", headers=headers, json={
        "name": "Groceries",
        "description": "Daily food & grocery items"
    })
    assert res.status_code == 201
    cat = res.json()
    assert cat["name"] == "Groceries"
    cat_id = cat["id"]

    # 2. Duplicate category in same shop
    dup_res = client.post(f"/shops/{shop_id}/categories", headers=headers, json={
        "name": "Groceries"
    })
    assert dup_res.status_code == 409

    # 3. List categories
    list_res = client.get(f"/shops/{shop_id}/categories", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 4. Update category
    patch_res = client.patch(f"/shops/{shop_id}/categories/{cat_id}", headers=headers, json={
        "name": "Spices & Groceries"
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Spices & Groceries"


def test_create_product_with_opening_stock_audit(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "produser@test.com", "Prod User", "Prod Shop")
    headers = {"Authorization": f"Bearer {token}"}

    # Create category first
    cat_res = client.post(f"/shops/{shop_id}/categories", headers=headers, json={"name": "Dairy"})
    cat_id = cat_res.json()["id"]

    # Create product with 25 opening stock
    payload = {
        "category_id": cat_id,
        "name": "Amul Butter 500g",
        "sku": "AMUL-BUT-500",
        "selling_price": "275.00",
        "cost_price": "250.00",
        "stock_quantity": "25.000",
        "unit": "packet",
        "low_stock_threshold": "5.000"
    }
    prod_res = client.post(f"/shops/{shop_id}/products", headers=headers, json=payload)
    assert prod_res.status_code == 201
    prod = prod_res.json()
    assert prod["name"] == "Amul Butter 500g"
    assert Decimal(prod["stock_quantity"]) == Decimal("25.000")
    assert prod["category_name"] == "Dairy"
    prod_id = prod["id"]

    # Verify that an "Opening Stock" StockMovement record was automatically created!
    mov_res = client.get(f"/shops/{shop_id}/products/{prod_id}/stock-movements", headers=headers)
    assert mov_res.status_code == 200
    movements = mov_res.json()
    assert len(movements) == 1
    assert movements[0]["movement_type"] == "IN"
    assert movements[0]["reason"] == "Opening Stock"
    assert Decimal(movements[0]["quantity"]) == Decimal("25.000")


def test_product_search_and_filter(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "searchuser@test.com", "Search User", "Search Shop")
    headers = {"Authorization": f"Bearer {token}"}

    # Add Category
    c_res = client.post(f"/shops/{shop_id}/categories", headers=headers, json={"name": "Beverages"})
    cat_bev_id = c_res.json()["id"]

    # Add Products
    client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "category_id": cat_bev_id,
        "name": "Tata Tea Gold",
        "sku": "TEA-TATA-250",
        "selling_price": "140.00",
        "cost_price": "120.00",
        "stock_quantity": "10.000",
        "unit": "packet"
    })

    client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Parle-G Biscuit",
        "sku": "BIS-PARLE-100",
        "selling_price": "10.00",
        "cost_price": "8.50",
        "stock_quantity": "50.000",
        "unit": "packet"
    })

    # Search for "tea"
    search_res = client.get(f"/shops/{shop_id}/products?search=tea", headers=headers)
    assert search_res.status_code == 200
    items = search_res.json()
    assert len(items) == 1
    assert items[0]["sku"] == "TEA-TATA-250"

    # Filter by category
    filter_res = client.get(f"/shops/{shop_id}/products?category_id={cat_bev_id}", headers=headers)
    assert filter_res.status_code == 200
    cat_items = filter_res.json()
    assert len(cat_items) == 1
    assert cat_items[0]["name"] == "Tata Tea Gold"


def test_product_update_does_not_allow_stock_bypass(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "updateuser@test.com", "Update User", "Update Shop")
    headers = {"Authorization": f"Bearer {token}"}

    prod_res = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Original Name",
        "selling_price": "100.00",
        "stock_quantity": "10.000",
        "unit": "pcs"
    })
    prod_id = prod_res.json()["id"]

    # Attempt to update stock_quantity in PATCH payload
    # Since stock_quantity is not in ProductUpdate schema, Pydantic ignores it and stock stays 10
    patch_res = client.patch(f"/shops/{shop_id}/products/{prod_id}", headers=headers, json={
        "name": "Updated Name",
        "stock_quantity": "999.000"
    })
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["name"] == "Updated Name"
    assert Decimal(updated["stock_quantity"]) == Decimal("10.000")  # Untouched!
