import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from tests.test_shops import register_and_login


def test_customer_crud_and_search(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "custowner@test.com", "Cust Owner", "Cust Store")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Customer with initial due
    c1 = client.post(f"/shops/{shop_id}/customers", headers=headers, json={
        "name": "Subhash Ghosh",
        "phone": "9830012345",
        "email": "subhash@example.com",
        "address": "Kolkata Bazaar",
        "initial_due": "550.00"
    })
    assert c1.status_code == 201
    c1_data = c1.json()
    assert c1_data["name"] == "Subhash Ghosh"
    assert Decimal(c1_data["outstanding_due"]) == Decimal("550.00")
    c1_id = c1_data["id"]

    # Create Customer with 0 due
    c2 = client.post(f"/shops/{shop_id}/customers", headers=headers, json={
        "name": "Ananya Sen",
        "phone": "9830099999",
        "initial_due": "0.00"
    })
    assert c2.status_code == 201

    # 2. Search customers by name
    search_res = client.get(f"/shops/{shop_id}/customers?search=subhash", headers=headers)
    assert search_res.status_code == 200
    assert len(search_res.json()) == 1
    assert search_res.json()[0]["phone"] == "9830012345"

    # 3. Filter customers with dues only
    dues_res = client.get(f"/shops/{shop_id}/customers?with_dues_only=true", headers=headers)
    assert dues_res.status_code == 200
    assert len(dues_res.json()) == 1
    assert dues_res.json()[0]["id"] == c1_id

    # 4. Update customer
    patch_res = client.patch(f"/shops/{shop_id}/customers/{c1_id}", headers=headers, json={
        "address": "Salt Lake Sector 5"
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["address"] == "Salt Lake Sector 5"

    # 5. Soft delete customer
    del_res = client.delete(f"/shops/{shop_id}/customers/{c1_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify excluded from active list
    active_res = client.get(f"/shops/{shop_id}/customers", headers=headers)
    assert active_res.status_code == 200
    assert all(c["id"] != c1_id for c in active_res.json())


def test_supplier_crud_and_search(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "suppowner@test.com", "Supp Owner", "Supp Store")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Supplier
    s1 = client.post(f"/shops/{shop_id}/suppliers", headers=headers, json={
        "name": "ITC Ltd Wholesale Distributor",
        "contact_person": "Manoj Verma",
        "phone": "9433311111",
        "email": "manoj@itc-dist.com",
        "address": "BBD Bagh, Kolkata",
        "initial_balance": "12000.00"
    })
    assert s1.status_code == 201
    s1_data = s1.json()
    assert s1_data["name"] == "ITC Ltd Wholesale Distributor"
    assert Decimal(s1_data["outstanding_balance"]) == Decimal("12000.00")
    s1_id = s1_data["id"]

    # 2. Search Supplier
    search_res = client.get(f"/shops/{shop_id}/suppliers?search=Verma", headers=headers)
    assert search_res.status_code == 200
    assert len(search_res.json()) == 1
    assert search_res.json()[0]["id"] == s1_id

    # 3. Update Supplier
    upd_res = client.patch(f"/shops/{shop_id}/suppliers/{s1_id}", headers=headers, json={
        "phone": "9433322222"
    })
    assert upd_res.status_code == 200
    assert upd_res.json()["phone"] == "9433322222"

    # 4. Delete Supplier
    del_res = client.delete(f"/shops/{shop_id}/suppliers/{s1_id}", headers=headers)
    assert del_res.status_code == 204
