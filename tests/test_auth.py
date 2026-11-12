import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_health_check(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_register_user_success(client: TestClient):
    payload = {
        "full_name": "Rahim Store Owner",
        "email": "rahim@example.com",
        "password": "StrongPassword123!",
        "shop_name": "Rahim General Store",
        "phone": "9876543210",
        "address": "Kolkata, WB"
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Registration successful"
    assert "user_id" in data
    assert "shop_id" in data


def test_register_user_duplicate_email(client: TestClient):
    payload = {
        "full_name": "First User",
        "email": "duplicate@example.com",
        "password": "StrongPassword123!",
        "shop_name": "First Shop",
    }
    res1 = client.post("/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/auth/register", json=payload)
    assert res2.status_code == 409
    assert res2.json()["detail"] == "Email already registered"


def test_login_success(client: TestClient):
    # Register first
    client.post("/auth/register", json={
        "full_name": "Login Tester",
        "email": "login@example.com",
        "password": "SecurePassword123!",
        "shop_name": "Login Shop"
    })

    # Login with form data
    login_data = {
        "username": "login@example.com",
        "password": "SecurePassword123!"
    }
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 200
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"


def test_login_invalid_credentials(client: TestClient):
    login_data = {
        "username": "nonexistent@example.com",
        "password": "WrongPassword123!"
    }
    response = client.post("/auth/login", data=login_data)
    assert response.status_code == 401


def test_get_current_user_profile(client: TestClient):
    # Register
    client.post("/auth/register", json={
        "full_name": "Profile Owner",
        "email": "profile@example.com",
        "password": "SecurePassword123!",
        "shop_name": "Profile Shop"
    })

    # Login
    login_res = client.post("/auth/login", data={
        "username": "profile@example.com",
        "password": "SecurePassword123!"
    })
    token = login_res.json()["access_token"]

    # Get /auth/me
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200
    profile = me_res.json()
    assert profile["email"] == "profile@example.com"
    assert profile["full_name"] == "Profile Owner"
