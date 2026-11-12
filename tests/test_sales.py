import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from tests.test_shops import register_and_login


def test_pos_sale_walk_in_customer_full_payment(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "posowner@test.com", "POS Owner", "POS Grocery")
    headers = {"Authorization": f"Bearer {token}"}

    # Add Product with 20 stock @ ₹50.00
    p_res = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Basmati Rice 1kg",
        "selling_price": "50.00",
        "stock_quantity": "20.000",
        "unit": "packet"
    })
    prod_id = p_res.json()["id"]

    # Sell 5 packets to Walk-in customer (5 * 50 = 250, pay 250 in cash)
    sale_payload = {
        "customer_id": None,
        "discount": "10.00",
        "tax": "5.00",
        "paid_amount": "245.00",  # (250 - 10 + 5 = 245.00)
        "payment_method": "CASH",
        "items": [
            {
                "product_id": prod_id,
                "quantity": "5.000"
            }
        ]
    }
    sale_res = client.post(f"/shops/{shop_id}/sales", headers=headers, json=sale_payload)
    assert sale_res.status_code == 201
    sale_data = sale_res.json()
    assert Decimal(sale_data["subtotal"]) == Decimal("250.00")
    assert Decimal(sale_data["discount"]) == Decimal("10.00")
    assert Decimal(sale_data["tax"]) == Decimal("5.00")
    assert Decimal(sale_data["total_amount"]) == Decimal("245.00")
    assert Decimal(sale_data["paid_amount"]) == Decimal("245.00")
    assert Decimal(sale_data["due_amount"]) == Decimal("0.00")
    sale_id = sale_data["id"]

    # Verify Product stock is now 20 - 5 = 15.000
    prod_check = client.get(f"/shops/{shop_id}/products/{prod_id}", headers=headers)
    assert Decimal(prod_check.json()["stock_quantity"]) == Decimal("15.000")

    # Verify Stock Movement was logged with movement_type "OUT"
    mov_res = client.get(f"/shops/{shop_id}/products/{prod_id}/stock-movements", headers=headers)
    assert mov_res.status_code == 200
    movements = mov_res.json()
    out_mov = movements[0]
    assert out_mov["movement_type"] == "OUT"
    assert Decimal(out_mov["quantity"]) == Decimal("5.000")

    # Verify Printable Receipt
    receipt_res = client.get(f"/shops/{shop_id}/sales/{sale_id}/receipt", headers=headers)
    assert receipt_res.status_code == 200
    r_data = receipt_res.json()
    assert r_data["invoice_number"] == sale_data["invoice_number"]
    assert r_data["shop"]["name"] == "POS Grocery"
    assert len(r_data["items"]) == 1
    assert r_data["items"][0]["product_name"] == "Basmati Rice 1kg"


def test_pos_sale_insufficient_stock_fails(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "outofstock@test.com", "OOS Owner", "OOS Shop")
    headers = {"Authorization": f"Bearer {token}"}

    # Add Product with only 2 stock
    p_res = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Ghee 500g",
        "selling_price": "350.00",
        "stock_quantity": "2.000",
        "unit": "jar"
    })
    prod_id = p_res.json()["id"]

    # Attempt to sell 5 jars
    sale_res = client.post(f"/shops/{shop_id}/sales", headers=headers, json={
        "paid_amount": "1750.00",
        "items": [
            {
                "product_id": prod_id,
                "quantity": "5.000"
            }
        ]
    })
    assert sale_res.status_code == 409
    assert "insufficient stock" in sale_res.json()["detail"].lower()


def test_pos_sale_with_customer_due_and_subsequent_repayment(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "dueowner@test.com", "Due Owner", "Credit Shop")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create registered Customer
    c_res = client.post(f"/shops/{shop_id}/customers", headers=headers, json={
        "name": "Bikash Roy",
        "phone": "9830055555",
        "initial_due": "0.00"
    })
    cust_id = c_res.json()["id"]

    # 2. Add Product with 10 stock @ ₹1,000.00
    p_res = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Electric Kettle",
        "selling_price": "1000.00",
        "stock_quantity": "10.000",
        "unit": "pcs"
    })
    prod_id = p_res.json()["id"]

    # 3. Customer buys 1 kettle worth ₹1,000, pays ₹600 in cash. Remaining due = ₹400
    sale_res = client.post(f"/shops/{shop_id}/sales", headers=headers, json={
        "customer_id": cust_id,
        "paid_amount": "600.00",
        "payment_method": "CASH",
        "items": [
            {"product_id": prod_id, "quantity": "1.000"}
        ]
    })
    assert sale_res.status_code == 201
    sale_data = sale_res.json()
    assert Decimal(sale_data["total_amount"]) == Decimal("1000.00")
    assert Decimal(sale_data["paid_amount"]) == Decimal("600.00")
    assert Decimal(sale_data["due_amount"]) == Decimal("400.00")

    # 4. Check Customer profile: outstanding_due should now be ₹400.00
    cust_check = client.get(f"/shops/{shop_id}/customers/{cust_id}", headers=headers)
    assert cust_check.status_code == 200
    assert Decimal(cust_check.json()["outstanding_due"]) == Decimal("400.00")

    # 5. Customer comes back next week and pays the remaining ₹400 via UPI
    pay_res = client.post(f"/shops/{shop_id}/payments", headers=headers, json={
        "customer_id": cust_id,
        "amount": "400.00",
        "payment_method": "UPI",
        "notes": "Paid via Google Pay"
    })
    assert pay_res.status_code == 201
    assert Decimal(pay_res.json()["amount"]) == Decimal("400.00")

    # 6. Customer profile: outstanding_due should now be ₹0.00
    cust_cleared = client.get(f"/shops/{shop_id}/customers/{cust_id}", headers=headers)
    assert Decimal(cust_cleared.json()["outstanding_due"]) == Decimal("0.00")

    # 7. Check Customer Ledger: should contain 1 sale and 2 payments (₹600 + ₹400)
    ledger_res = client.get(f"/shops/{shop_id}/customers/{cust_id}/ledger", headers=headers)
    assert ledger_res.status_code == 200
    ledger = ledger_res.json()
    assert len(ledger["sales"]) == 1
    assert len(ledger["payments"]) == 2
