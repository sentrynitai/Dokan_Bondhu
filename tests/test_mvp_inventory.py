from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from tests.test_shops import register_and_login


def test_mvp_product_create_minimal_fields(client: TestClient):
    """Shopkeeper can add a product with only required fields (name, stock_quantity, low_stock_limit) without selling_price."""
    token, user_id, shop_id = register_and_login(client, "mvp_min@test.com", "MVP Shopkeeper", "MVP Store")
    headers = {"Authorization": f"Bearer {token}"}

    # Add product without selling_price or cost_price
    payload = {
        "name": "Tata Salt 1kg",
        "stock_quantity": "50.000",
        "low_stock_limit": "10.000",
        "unit": "packet",
        "sku": "SALT-TATA-01"
    }
    res = client.post(f"/shops/{shop_id}/products", headers=headers, json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Tata Salt 1kg"
    assert Decimal(str(data["stock_quantity"])) == Decimal("50.000")
    assert Decimal(str(data["quantity"])) == Decimal("50.000")
    assert Decimal(str(data["low_stock_limit"])) == Decimal("10.000")
    assert Decimal(str(data["low_stock_threshold"])) == Decimal("10.000")
    assert data["sku"] == "SALT-TATA-01"
    assert data["unit"] == "packet"


def test_mvp_duplicate_sku_prevention(client: TestClient):
    """Adding a product with an existing SKU in the same shop must be rejected with 409 Conflict."""
    token, user_id, shop_id = register_and_login(client, "mvp_sku@test.com", "SKU Owner", "SKU Shop")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "name": "Maggi 2-Min Noodles",
        "stock_quantity": "20.000",
        "low_stock_limit": "5.000",
        "sku": "MAGGI-70G"
    }
    res1 = client.post(f"/shops/{shop_id}/products", headers=headers, json=payload)
    assert res1.status_code == 201

    # Attempt to create duplicate SKU in same shop
    dup_payload = {
        "name": "Another Maggi Item",
        "stock_quantity": "10.000",
        "low_stock_limit": "2.000",
        "sku": "MAGGI-70G"
    }
    res2 = client.post(f"/shops/{shop_id}/products", headers=headers, json=dup_payload)
    assert res2.status_code == 409
    assert "SKU" in res2.json()["detail"]


def test_mvp_update_stock_increase_and_decrease(client: TestClient):
    """Shopkeeper can increase and decrease stock quantity with immediate database persistence and movement logging."""
    token, user_id, shop_id = register_and_login(client, "mvp_stock@test.com", "Stock Manager", "Stock Shop")
    headers = {"Authorization": f"Bearer {token}"}

    # Create product with 10 units
    create_res = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Basmati Rice 5kg",
        "stock_quantity": "10.000",
        "low_stock_limit": "5.000",
        "unit": "bag"
    })
    assert create_res.status_code == 201
    prod_id = create_res.json()["id"]

    # 1. Increase Stock by +15
    inc_res = client.post(f"/shops/{shop_id}/products/{prod_id}/stock", headers=headers, json={
        "action": "increase",
        "quantity": "15.000",
        "reason": "New delivery received"
    })
    assert inc_res.status_code == 200
    assert Decimal(str(inc_res.json()["stock_quantity"])) == Decimal("25.000")

    # Verify via GET product
    get_res = client.get(f"/shops/{shop_id}/products/{prod_id}", headers=headers)
    assert get_res.status_code == 200
    assert Decimal(str(get_res.json()["stock_quantity"])) == Decimal("25.000")

    # 2. Decrease Stock by -8
    dec_res = client.post(f"/shops/{shop_id}/products/{prod_id}/stock", headers=headers, json={
        "action": "decrease",
        "quantity": "8.000",
        "reason": "Damaged bag discarded"
    })
    assert dec_res.status_code == 200
    assert Decimal(str(dec_res.json()["stock_quantity"])) == Decimal("17.000")

    # 3. Decrease Stock exceeding available quantity (17 - 20) -> Must fail with 409
    fail_res = client.post(f"/shops/{shop_id}/products/{prod_id}/stock", headers=headers, json={
        "action": "decrease",
        "quantity": "20.000",
        "reason": "Excess deduction"
    })
    assert fail_res.status_code == 409
    assert "insufficient" in fail_res.json()["detail"].lower()

    # Stock remains 17
    get_res_after = client.get(f"/shops/{shop_id}/products/{prod_id}", headers=headers)
    assert Decimal(str(get_res_after.json()["stock_quantity"])) == Decimal("17.000")


def test_mvp_low_stock_and_inventory_summary(client: TestClient):
    """Verify 4 dashboard KPI cards and low-stock endpoint accuracy."""
    token, user_id, shop_id = register_and_login(client, "mvp_kpi@test.com", "KPI Owner", "KPI Market")
    headers = {"Authorization": f"Bearer {token}"}

    # Product 1: In Stock (20 units, limit 5)
    client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Well Stocked Item",
        "stock_quantity": "20.000",
        "low_stock_limit": "5.000"
    })

    # Product 2: Low Stock (3 units, limit 5)
    client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Low Stock Item",
        "stock_quantity": "3.000",
        "low_stock_limit": "5.000"
    })

    # Product 3: Out of Stock (0 units, limit 5)
    client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Out of Stock Item",
        "stock_quantity": "0.000",
        "low_stock_limit": "5.000"
    })

    # Check Inventory Summary
    summary_res = client.get(f"/shops/{shop_id}/inventory/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()

    assert summary["total_products"] == 3
    assert Decimal(str(summary["total_stock_quantity"])) == Decimal("23.000")
    assert summary["low_stock_products"] == 1  # 3 units > 0 and <= 5
    assert summary["out_of_stock_products"] == 1  # 0 units
    assert summary["total_low_stock"] == 2  # items needing restock (low + out)

    # Check Low Stock list endpoint
    low_res = client.get(f"/shops/{shop_id}/inventory/low-stock", headers=headers)
    assert low_res.status_code == 200
    low_items = low_res.json()
    assert len(low_items) == 2
    # Verify sorted ascending by stock (0 first, then 3)
    assert Decimal(str(low_items[0]["stock_quantity"])) == Decimal("0.000")
    assert Decimal(str(low_items[1]["stock_quantity"])) == Decimal("3.000")


def test_mvp_soft_delete_product(client: TestClient):
    """Soft deleting a product sets is_active=False, hides it from product list and dashboard."""
    token, user_id, shop_id = register_and_login(client, "mvp_del@test.com", "Delete User", "Delete Shop")
    headers = {"Authorization": f"Bearer {token}"}

    create_res = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Item To Delete",
        "stock_quantity": "10.000",
        "low_stock_limit": "5.000"
    })
    prod_id = create_res.json()["id"]

    # Delete product
    del_res = client.delete(f"/shops/{shop_id}/products/{prod_id}", headers=headers)
    assert del_res.status_code == 204

    # GET products list should not return it
    list_res = client.get(f"/shops/{shop_id}/products", headers=headers)
    assert len(list_res.json()) == 0

    # Summary count should be 0
    sum_res = client.get(f"/shops/{shop_id}/inventory/summary", headers=headers)
    assert sum_res.json()["total_products"] == 0


def test_mvp_auth_protection_and_logout(client: TestClient):
    """Unauthenticated requests must be rejected with 401 Unauthorized, and logout succeeds."""
    # Unauthenticated access to products
    unauth_res = client.get("/shops/1/products")
    assert unauth_res.status_code == 401

    # Unauthenticated access to summary
    unauth_sum = client.get("/shops/1/inventory/summary")
    assert unauth_sum.status_code == 401

    # Logout endpoint
    logout_res = client.post("/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json()["message"] == "Logged out successfully"
