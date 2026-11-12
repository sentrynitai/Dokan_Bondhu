import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from tests.test_shops import register_and_login


def test_dashboard_and_reports(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "dashowner@test.com", "Dash Owner", "Analytics Shop")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a customer with initial due
    c_res = client.post(f"/shops/{shop_id}/customers", headers=headers, json={
        "name": "Nirupam Sen",
        "phone": "9800011223",
        "initial_due": "200.00"
    })
    cust_id = c_res.json()["id"]

    # 2. Add 2 products
    p1 = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Wheat Flour 5kg",
        "sku": "FLOUR-5KG",
        "selling_price": "220.00",
        "cost_price": "190.00",
        "stock_quantity": "30.000",
        "unit": "packet",
        "low_stock_threshold": "10.000"
    }).json()

    p2 = client.post(f"/shops/{shop_id}/products", headers=headers, json={
        "name": "Salt 1kg",
        "sku": "SALT-1KG",
        "selling_price": "25.00",
        "cost_price": "20.00",
        "stock_quantity": "5.000",
        "unit": "packet",
        "low_stock_threshold": "10.000"  # This will be low stock!
    }).json()

    # 3. Create a Sale: 2 packets Wheat Flour = 440.00
    sale_res = client.post(f"/shops/{shop_id}/sales", headers=headers, json={
        "customer_id": cust_id,
        "paid_amount": "440.00",
        "payment_method": "UPI",
        "items": [{"product_id": p1["id"], "quantity": "2.000"}]
    })
    assert sale_res.status_code == 201

    # 4. Fetch Dashboard Summary
    dash_res = client.get(f"/shops/{shop_id}/dashboard", headers=headers)
    assert dash_res.status_code == 200
    dash = dash_res.json()

    assert Decimal(dash["today_sales_amount"]) == Decimal("440.00")
    assert dash["today_sales_count"] == 1
    assert dash["total_products"] == 2
    # Inventory units: (30 - 2) + 5 = 33.000
    assert Decimal(dash["total_inventory_units"]) == Decimal("33.000")
    assert dash["low_stock_products_count"] == 1  # Salt has 5 remaining <= threshold 10
    assert dash["total_customers"] == 1
    assert Decimal(dash["total_outstanding_dues"]) == Decimal("200.00")
    assert len(dash["recent_sales"]) == 1
    assert len(dash["top_selling_products"]) == 1
    assert dash["top_selling_products"][0]["product_name"] == "Wheat Flour 5kg"

    # 5. Fetch Sales Report
    sales_rep_res = client.get(f"/shops/{shop_id}/reports/sales", headers=headers)
    assert sales_rep_res.status_code == 200
    assert sales_rep_res.json()["total_invoices"] == 1
    assert Decimal(sales_rep_res.json()["total_revenue"]) == Decimal("440.00")

    # 6. Test CSV Exports
    sales_csv = client.get(f"/shops/{shop_id}/reports/sales/csv", headers=headers)
    assert sales_csv.status_code == 200
    assert "text/csv" in sales_csv.headers["content-type"]
    assert "Wheat Flour" not in sales_csv.text  # Sales report has invoice headers
    assert "Nirupam Sen" in sales_csv.text

    dues_csv = client.get(f"/shops/{shop_id}/reports/customer-dues/csv", headers=headers)
    assert dues_csv.status_code == 200
    assert "Nirupam Sen" in dues_csv.text
    assert "200.00" in dues_csv.text

    inv_csv = client.get(f"/shops/{shop_id}/reports/inventory/csv", headers=headers)
    assert inv_csv.status_code == 200
    assert "FLOUR-5KG" in inv_csv.text
    assert "SALT-1KG" in inv_csv.text
