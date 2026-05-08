from fastapi.testclient import TestClient

from app.main import create_app
from app.services.user_service import user_store

client = TestClient(create_app())


def setup_function() -> None:
    # Reset in-memory storage so tests stay isolated.
    user_store.clear()


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_login_and_protected_flow() -> None:
    credentials = {"username": "testuser", "password": "testpass123"}

    register_response = client.post("/auth/register", json=credentials)
    assert register_response.status_code == 201
    register_token = register_response.json()["access_token"]

    login_response = client.post("/auth/login", json=credentials)
    assert login_response.status_code == 200
    login_token = login_response.json()["access_token"]
    assert login_token
    assert register_token

    protected_response = client.get(
        "/protected",
        headers={"Authorization": f"Bearer {login_token}"},
    )
    assert protected_response.status_code == 200
    assert protected_response.json() == {"message": "Hello testuser"}


def test_login_rejects_invalid_credentials() -> None:
    response = client.post(
        "/auth/login",
        json={"username": "missing", "password": "wrongpass123"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_list_users_returns_registered_usernames() -> None:
    credentials = {"username": "alice", "password": "alicepass123"}
    register_response = client.post("/auth/register", json=credentials)
    token = register_response.json()["access_token"]

    response = client.get(
        "/auth/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json() == {"users": ["alice"]}


def test_list_users_requires_authentication() -> None:
    response = client.get("/auth/users")
    assert response.status_code == 403
