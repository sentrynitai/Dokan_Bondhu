import pytest
from fastapi.testclient import TestClient


def register_and_login(client: TestClient, email: str, name: str, shop_name: str) -> tuple[str, int, int]:
    """Helper to register and login a user, returning (token, user_id, shop_id)."""
    reg_res = client.post("/auth/register", json={
        "full_name": name,
        "email": email,
        "password": "Password123!",
        "shop_name": shop_name,
        "phone": "9999999999",
        "address": "Kolkata"
    })
    assert reg_res.status_code == 201
    user_id = reg_res.json()["user_id"]
    shop_id = reg_res.json()["shop_id"]

    login_res = client.post("/auth/login", data={
        "username": email,
        "password": "Password123!"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return token, user_id, shop_id


def test_get_my_shops(client: TestClient):
    token, user_id, shop_id = register_and_login(client, "shopowner@test.com", "Shop Owner", "My Super Store")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/shops", headers=headers)
    assert res.status_code == 200
    shops = res.json()
    assert len(shops) >= 1
    assert any(s["id"] == shop_id and s["role"] == "owner" for s in shops)


def test_create_additional_shop(client: TestClient):
    token, user_id, first_shop_id = register_and_login(client, "multishop@test.com", "Multi Shop Owner", "Shop One")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/shops", headers=headers, json={
        "name": "Shop Two",
        "phone": "8888888888",
        "address": "Howrah"
    })
    assert res.status_code == 201
    new_shop = res.json()
    assert new_shop["name"] == "Shop Two"
    assert new_shop["role"] == "owner"

    # Now verify GET /shops returns both shops
    list_res = client.get("/shops", headers=headers)
    assert list_res.status_code == 200
    shop_ids = [s["id"] for s in list_res.json()]
    assert first_shop_id in shop_ids
    assert new_shop["id"] in shop_ids


def test_shop_data_isolation(client: TestClient):
    # Owner 1
    token1, user1_id, shop1_id = register_and_login(client, "owner1@test.com", "Owner 1", "Shop 1")
    # Owner 2
    token2, user2_id, shop2_id = register_and_login(client, "owner2@test.com", "Owner 2", "Shop 2")

    headers2 = {"Authorization": f"Bearer {token2}"}

    # Owner 2 tries to access Shop 1
    res = client.get(f"/shops/{shop1_id}", headers=headers2)
    assert res.status_code == 403
    assert "access to this shop" in res.json()["detail"].lower()


def test_add_member_and_role_permissions(client: TestClient):
    # Register Owner
    owner_token, owner_id, shop_id = register_and_login(client, "bigboss@test.com", "Big Boss", "Boss Store")
    # Register another user (future staff)
    staff_token, staff_id, staff_shop_id = register_and_login(client, "worker@test.com", "Worker Bee", "Worker Store")

    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Owner adds staff to Boss Store
    add_res = client.post(f"/shops/{shop_id}/members", headers=owner_headers, json={
        "email": "worker@test.com",
        "role": "staff"
    })
    assert add_res.status_code == 201
    assert add_res.json()["role"] == "staff"

    # Worker can now access Boss Store as staff
    worker_access = client.get(f"/shops/{shop_id}", headers=staff_headers)
    assert worker_access.status_code == 200
    assert worker_access.json()["role"] == "staff"

    # But worker CANNOT update shop profile (only owner can)
    patch_res = client.patch(f"/shops/{shop_id}", headers=staff_headers, json={"name": "Hacked Store"})
    assert patch_res.status_code == 403
