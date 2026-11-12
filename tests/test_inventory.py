import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from tests.test_shops import register_and_login


def test_stock_in_and_out(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "invuser@test.com", "Inv User", "Inv Store")
    headers = {"Authorization": f"Bearer {token}"}

    # Create Product with 10 initial stock
    p_res = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Fortune Oil 1L",
        "selling_price": "150.00",
        "cost_price": "130.00",
        "stock_quantity": "10.000",
        "unit": "litre",
        "low_stock_threshold": "5.000"
    })
    assert p_res.status_code == 201
    prod_id = p_res.json()["id"]

    # 1. Stock In +15 litres
    in_res = client.post(f"/shops/{shop_id}/products/{prod_id}/stock-in", headers=headers, json={
        "quantity": "15.000",
        "reason": "Supplier shipment received"
    })
    assert in_res.status_code == 201
    in_data = in_res.json()
    assert in_data["movement_type"] == "IN"
    assert Decimal(in_data["quantity_before"]) == Decimal("10.000")
    assert Decimal(in_data["quantity_after"]) == Decimal("25.000")

    # 2. Stock Out -5 litres (e.g. damaged bottle)
    out_res = client.post(f"/shops/{shop_id}/products/{prod_id}/stock-out", headers=headers, json={
        "quantity": "5.000",
        "reason": "Leakage damaged in warehouse"
    })
    assert out_res.status_code == 201
    out_data = out_res.json()
    assert out_data["movement_type"] == "OUT"
    assert Decimal(out_data["quantity_before"]) == Decimal("25.000")
    assert Decimal(out_data["quantity_after"]) == Decimal("20.000")

    # 3. Stock Out greater than available (should fail with 409)
    fail_res = client.post(f"/shops/{shop_id}/products/{prod_id}/stock-out", headers=headers, json={
        "quantity": "99.000",
        "reason": "Excess quantity request"
    })
    assert fail_res.status_code == 409
    assert "insufficient" in fail_res.json()["detail"].lower()


def test_stock_adjust_audit(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "adjuster@test.com", "Adjuster", "Audit Store")
    headers = {"Authorization": f"Bearer {token}"}

    p_res = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Sugar 1kg",
        "selling_price": "45.00",
        "cost_price": "40.00",
        "stock_quantity": "20.000",
        "unit": "kg"
    })
    prod_id = p_res.json()["id"]

    # Counted 17 on the shelf (missing 3 kg)
    adj_res = client.post(f"/shops/{shop_id}/products/{prod_id}/stock-adjust", headers=headers, json={
        "counted_quantity": "17.000",
        "reason": "Monthly physical audit"
    })
    assert adj_res.status_code == 200
    adj_data = adj_res.json()
    assert adj_data["movement_type"] == "OUT"
    assert Decimal(adj_data["quantity"]) == Decimal("3.000")
    assert Decimal(adj_data["quantity_after"]) == Decimal("17.000")


def test_inventory_summary_and_low_stock(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "summary@test.com", "Summary User", "Summary Store")
    headers = {"Authorization": f"Bearer {token}"}

    # Product 1: Low stock (2 remaining, threshold is 5)
    client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Milk 500ml",
        "selling_price": "30.00",
        "cost_price": "26.00",
        "stock_quantity": "2.000",
        "unit": "packet",
        "low_stock_threshold": "5.000"
    })

    # Product 2: High stock (50 remaining, threshold is 10)
    client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Rice 1kg",
        "selling_price": "60.00",
        "cost_price": "50.00",
        "stock_quantity": "50.000",
        "unit": "kg",
        "low_stock_threshold": "10.000"
    })

    # Check low-stock endpoint
    low_res = client.get(f"/shops/{shop_id}/inventory/low-stock", headers=headers)
    assert low_res.status_code == 200
    low_items = low_res.json()
    assert len(low_items) == 1
    assert low_items[0]["name"] == "Milk 500ml"

    # Check inventory summary
    sum_res = client.get(f"/shops/{shop_id}/inventory/summary", headers=headers)
    assert sum_res.status_code == 200
    summary = sum_res.json()
    assert summary["total_products"] == 2
    assert Decimal(summary["total_units_in_stock"]) == Decimal("52.000")
    assert summary["low_stock_count"] == 1
    # Cost valuation: (2 * 26) + (50 * 50) = 52 + 2500 = 2552.00
    assert Decimal(summary["total_cost_valuation"]) == Decimal("2552.00")
    # Retail valuation: (2 * 30) + (50 * 60) = 60 + 3000 = 3060.00
    assert Decimal(summary["total_retail_valuation"]) == Decimal("3060.00")
