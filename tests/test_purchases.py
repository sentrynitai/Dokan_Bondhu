import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from tests.test_shops import register_and_login


def test_create_purchase_increases_stock_and_updates_supplier_balance(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "po_owner@test.com", "PO Owner", "PO Shop")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Supplier with 0 balance
    s_res = client.post(f"/shops/{shop_id}/suppliers", headers=headers, json={
        "name": "Hindustan Unilever Wholesale",
        "phone": "9990001111",
        "initial_balance": "0.00"
    })
    supp_id = s_res.json()["id"]

    # 2. Create Product with initial stock of 10 and cost_price 80
    p_res = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Dove Soap 100g",
        "selling_price": "100.00",
        "cost_price": "80.00",
        "stock_quantity": "10.000",
        "unit": "pcs"
    })
    prod_id = p_res.json()["id"]

    # 3. Create Purchase: Buy 40 pieces @ ₹82.00 (Total = ₹3,280.00), Pay ₹2,000.00 (Due = ₹1,280.00)
    po_payload = {
        "supplier_id": supp_id,
        "paid_amount": "2000.00",
        "notes": "Weekly batch restock",
        "update_product_cost": True,
        "items": [
            {
                "product_id": prod_id,
                "quantity": "40.000",
                "unit_cost": "82.00"
            }
        ]
    }
    po_res = client.post(f"/shops/{shop_id}/purchases", headers=headers, json=po_payload)
    assert po_res.status_code == 201
    po_data = po_res.json()
    assert Decimal(po_data["total_amount"]) == Decimal("3280.00")
    assert Decimal(po_data["paid_amount"]) == Decimal("2000.00")
    assert po_data["supplier_name"] == "Hindustan Unilever Wholesale"

    # 4. Verify Product Stock is now 10 + 40 = 50.000, and cost_price is updated to 82.00
    prod_check = client.get(f"/shops/{shop_id}/products/{prod_id}", headers=headers)
    assert prod_check.status_code == 200
    p_info = prod_check.json()
    assert Decimal(p_info["stock_quantity"]) == Decimal("50.000")
    assert Decimal(p_info["cost_price"]) == Decimal("82.00")

    # 5. Verify Supplier outstanding_balance is now 1280.00
    supp_check = client.get(f"/shops/{shop_id}/suppliers/{supp_id}", headers=headers)
    assert supp_check.status_code == 200
    s_info = supp_check.json()
    assert Decimal(s_info["outstanding_balance"]) == Decimal("1280.00")

    # 6. Verify Stock Movement entry was logged
    mov_res = client.get(f"/shops/{shop_id}/products/{prod_id}/stock-movements", headers=headers)
    assert mov_res.status_code == 200
    movements = mov_res.json()
    # Should have Opening Stock (10) and Purchase (40)
    assert len(movements) == 2
    po_mov = movements[0]  # Latest
    assert po_mov["movement_type"] == "IN"
    assert Decimal(po_mov["quantity"]) == Decimal("40.000")
    assert Decimal(po_mov["quantity_before"]) == Decimal("10.000")
    assert Decimal(po_mov["quantity_after"]) == Decimal("50.000")
    assert "Purchase" in po_mov["reason"]
