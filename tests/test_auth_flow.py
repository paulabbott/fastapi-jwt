from fastapi.testclient import TestClient
import json
import os
from pathlib import Path

from app.main import create_app
from app.services.group_service import group_store
from app.services.survey_store import survey_store
from app.services.user_service import user_store

client = TestClient(create_app())


def _bootstrap_super_admin(username: str = "admin@test.invalid", password: str = "adminpass123") -> str:
    r = client.post("/auth/bootstrap", json={"username": username, "password": password})
    assert r.status_code == 201, r.text
    return str(r.json()["group"])


def _login(username: str, password: str) -> str:
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _admin_create(
    token: str,
    username: str,
    password: str,
    role: str,
    group: str,
):
    return client.post(
        "/auth/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "username": username,
            "password": password,
            "role": role,
            "group": group,
        },
    )


def setup_function() -> None:
    user_store.clear()
    group_store.clear()
    survey_store.clear()


def test_bootstrap_global_admin_group_has_super_admin_flag() -> None:
    cid = _bootstrap_super_admin("gaf@test.invalid", "gafpass123")
    token = _login("gaf@test.invalid", "gafpass123")
    r = client.get("/auth/admin/groups", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    row = next(c for c in r.json()["groups"] if c["id"] == cid)
    assert row["name"] == "Global Admin"
    assert row["is_super_admin_group"] is True


def test_admin_created_group_is_not_super_admin_group() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    r = client.post(
        "/auth/admin/groups",
        headers={"Authorization": f"Bearer {owner}"},
        json={"name": "Regional"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["is_super_admin_group"] is False
    r2 = client.get("/auth/admin/groups", headers={"Authorization": f"Bearer {owner}"})
    row = next(c for c in r2.json()["groups"] if c["id"] == body["id"])
    assert row["is_super_admin_group"] is False
    bootstrap_row = next(c for c in r2.json()["groups"] if c["id"] == cid)
    assert bootstrap_row["is_super_admin_group"] is True


def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_bootstrap_succeeds_when_users_file_is_empty() -> None:
    """Touching an empty users.json must not crash JSON parse; store is treated as empty."""
    path = Path(os.environ["USERS_STORE_PATH"])
    path.write_text("", encoding="utf-8")
    r = client.post("/auth/bootstrap", json={"username": "emptyfile@test.invalid", "password": "secretpass12"})
    assert r.status_code == 201, r.text


def test_new_users_have_bcrypt_password_in_store() -> None:
    _bootstrap_super_admin("bcryptcheck@test.invalid", "secretpass12")
    path = os.environ["USERS_STORE_PATH"]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    stored = data["bcryptcheck@test.invalid"]["password"]
    assert stored.startswith("$2")
    assert data["bcryptcheck@test.invalid"]["group"]


def test_bootstrap_login_and_protected_flow() -> None:
    _bootstrap_super_admin("testuser", "testpass123")
    token = _login("testuser", "testpass123")
    assert token

    protected_response = client.get(
        "/protected",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert protected_response.status_code == 200
    assert protected_response.json() == {"message": "Hello testuser"}


def test_bootstrap_rejected_when_users_exist() -> None:
    _bootstrap_super_admin("a@test.invalid", "apass12345")
    r = client.post("/auth/bootstrap", json={"username": "b@test.invalid", "password": "bpass12345"})
    assert r.status_code == 403


def test_login_rejects_invalid_credentials() -> None:
    response = client.post(
        "/auth/login",
        json={"username": "missing", "password": "wrongpass123"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_list_users_returns_created_usernames() -> None:
    cid = _bootstrap_super_admin("alice@test.invalid", "alicepass123")
    token = _login("alice@test.invalid", "alicepass123")
    assert _admin_create(token, "bob@test.invalid", "bobpass123", "survey_runner", cid).status_code == 201

    response = client.get(
        "/auth/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json() == {"users": ["alice@test.invalid", "bob@test.invalid"]}


def test_list_users_requires_authentication() -> None:
    response = client.get("/auth/users")
    assert response.status_code == 403


def test_jwt_rejected_when_user_removed_from_store() -> None:
    """Cryptographically valid token must not work if the user row is gone (e.g. in-memory reset)."""
    _bootstrap_super_admin("gone@test.invalid", "gonepass123")
    token = _login("gone@test.invalid", "gonepass123")
    user_store.clear()

    r = client.get("/protected", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    assert r.json()["detail"] == "User not found or no longer active"

    r2 = client.get("/auth/users", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 401
    assert r2.json()["detail"] == "User not found or no longer active"

    r3 = _admin_create(
        token,
        "new@test.invalid",
        "newpass123",
        "survey_creator",
        "00000000-0000-0000-0000-000000000001",
    )
    assert r3.status_code == 401
    assert r3.json()["detail"] == "User not found or no longer active"


def test_admin_create_requires_super_admin_jwt() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    assert _admin_create(owner, "bob@test.invalid", "bobpass123", "survey_runner", cid).status_code == 201

    assert _admin_create(owner, "carol@test.invalid", "carolpass123", "survey_creator", cid).status_code == 201
    carol = _login("carol@test.invalid", "carolpass123")
    r = _admin_create(carol, "dave@test.invalid", "davepass123", "survey_runner", cid)
    assert r.status_code == 403


def test_admin_create_requires_auth() -> None:
    user_store.clear()
    group_store.clear()
    cid = _bootstrap_super_admin()
    r = client.post(
        "/auth/admin/users",
        json={
            "username": "x@test.invalid",
            "password": "xpass12345",
            "role": "survey_creator",
            "group": cid,
        },
    )
    assert r.status_code == 403


def test_list_super_admins_requires_super_admin() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    assert _admin_create(owner, "sa2@test.invalid", "sa2pass12345", "super_admin", cid).status_code == 201
    assert _admin_create(owner, "carol@test.invalid", "carolpass12", "survey_creator", cid).status_code == 201
    token_sa2 = _login("sa2@test.invalid", "sa2pass12345")
    assert client.get("/auth/super-admins", headers={"Authorization": f"Bearer {token_sa2}"}).status_code == 200
    token_carol = _login("carol@test.invalid", "carolpass12")
    assert client.get("/auth/super-admins", headers={"Authorization": f"Bearer {token_carol}"}).status_code == 403


def test_list_super_admins_returns_super_admins_only() -> None:
    cid = _bootstrap_super_admin("root@test.invalid", "rootpass123")
    root = _login("root@test.invalid", "rootpass123")
    assert _admin_create(root, "other@test.invalid", "otherpass12", "super_admin", cid).status_code == 201
    assert _admin_create(root, "norm@test.invalid", "normpass12", "survey_creator", cid).status_code == 201
    r = client.get("/auth/super-admins", headers={"Authorization": f"Bearer {root}"})
    assert r.status_code == 200
    names = set(r.json()["super_admins"])
    assert names == {"other@test.invalid", "root@test.invalid"}


def test_admin_delete_user() -> None:
    cid = _bootstrap_super_admin("del1@test.invalid", "del1pass123")
    d1 = _login("del1@test.invalid", "del1pass123")
    assert _admin_create(d1, "del2@test.invalid", "del2pass123", "super_admin", cid).status_code == 201
    r = client.delete("/auth/admin/users/del2%40test.invalid", headers={"Authorization": f"Bearer {d1}"})
    assert r.status_code == 204
    assert not user_store.exists("del2@test.invalid")


def test_admin_cannot_delete_self_or_last_super_admin() -> None:
    _bootstrap_super_admin("solo@test.invalid", "solopass123")
    solo = _login("solo@test.invalid", "solopass123")
    r = client.delete("/auth/admin/users/solo%40test.invalid", headers={"Authorization": f"Bearer {solo}"})
    assert r.status_code == 400
    assert user_store.exists("solo@test.invalid")


def test_super_admins_list_scoped_to_callers_group() -> None:
    cid_a = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    r_co = client.post(
        "/auth/admin/groups",
        headers={"Authorization": f"Bearer {owner}"},
        json={"name": "Other org"},
    )
    assert r_co.status_code == 201, r_co.text
    cid_b = r_co.json()["id"]
    assert _admin_create(owner, "remote@test.invalid", "remotepass12", "super_admin", cid_b).status_code == 201
    r = client.get("/auth/super-admins", headers={"Authorization": f"Bearer {owner}"})
    assert r.status_code == 200
    assert set(r.json()["super_admins"]) == {"owner@test.invalid"}
    assert cid_a != cid_b


def test_admin_create_rejects_unknown_group() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    r = _admin_create(
        owner,
        "ghost@test.invalid",
        "ghostpass12",
        "survey_creator",
        "00000000-0000-0000-0000-00000000dead",
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "Unknown group"


def test_admin_cannot_delete_user_in_other_group() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    r_co = client.post(
        "/auth/admin/groups",
        headers={"Authorization": f"Bearer {owner}"},
        json={"name": "Satellite"},
    )
    cid_b = r_co.json()["id"]
    assert _admin_create(owner, "ext@test.invalid", "extpass12345", "survey_creator", cid_b).status_code == 201
    r = client.delete(
        "/auth/admin/users/ext%40test.invalid",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 404


def test_admin_groups_endpoints_require_super_admin() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    assert _admin_create(owner, "carol@test.invalid", "carolpass12", "survey_creator", cid).status_code == 201
    carol = _login("carol@test.invalid", "carolpass12")
    assert client.get("/auth/admin/groups", headers={"Authorization": f"Bearer {carol}"}).status_code == 403
    assert (
        client.post(
            "/auth/admin/groups",
            headers={"Authorization": f"Bearer {carol}"},
            json={"name": "X"},
        ).status_code
        == 403
    )
    r = client.get("/auth/admin/groups", headers={"Authorization": f"Bearer {owner}"})
    assert r.status_code == 200
    groups = r.json()["groups"]
    assert len(groups) >= 1
    assert any(c["id"] == cid for c in groups)


def test_list_group_users_member_can_list_own_group() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    r_co = client.post(
        "/auth/admin/groups",
        headers={"Authorization": f"Bearer {owner}"},
        json={"name": "Acme"},
    )
    assert r_co.status_code == 201, r_co.text
    cid_acme = r_co.json()["id"]
    assert _admin_create(owner, "alice@test.invalid", "alicepass123", "survey_creator", cid_acme).status_code == 201
    assert _admin_create(owner, "bob@test.invalid", "bobpass12345", "survey_runner", cid_acme).status_code == 201
    alice = _login("alice@test.invalid", "alicepass123")
    r = client.get(f"/auth/groups/{cid_acme}/users", headers={"Authorization": f"Bearer {alice}"})
    assert r.status_code == 200
    body = r.json()["users"]
    assert len(body) == 2
    by_name = {u["username"]: u["role"] for u in body}
    assert by_name["alice@test.invalid"] == "survey_creator"
    assert by_name["bob@test.invalid"] == "survey_runner"


def test_list_group_users_forbidden_for_other_group() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    r_co = client.post(
        "/auth/admin/groups",
        headers={"Authorization": f"Bearer {owner}"},
        json={"name": "East"},
    )
    assert r_co.status_code == 201, r_co.text
    cid_east = r_co.json()["id"]
    r_west = client.post(
        "/auth/admin/groups",
        headers={"Authorization": f"Bearer {owner}"},
        json={"name": "West"},
    )
    assert r_west.status_code == 201, r_west.text
    cid_west = r_west.json()["id"]
    assert _admin_create(owner, "eastu@test.invalid", "eastpass123", "survey_creator", cid_east).status_code == 201
    east_token = _login("eastu@test.invalid", "eastpass123")
    r = client.get(f"/auth/groups/{cid_west}/users", headers={"Authorization": f"Bearer {east_token}"})
    assert r.status_code == 403
    assert r.json()["detail"] == "Not allowed to list users for this group"


def test_list_group_users_super_admin_any_group() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    r_co = client.post(
        "/auth/admin/groups",
        headers={"Authorization": f"Bearer {owner}"},
        json={"name": "Remote"},
    )
    assert r_co.status_code == 201, r_co.text
    cid_remote = r_co.json()["id"]
    assert _admin_create(owner, "ru@test.invalid", "rupass1234", "survey_runner", cid_remote).status_code == 201
    r = client.get(f"/auth/groups/{cid_remote}/users", headers={"Authorization": f"Bearer {owner}"})
    assert r.status_code == 200
    users = r.json()["users"]
    assert len(users) == 1
    assert users[0]["username"] == "ru@test.invalid"
    assert users[0]["role"] == "survey_runner"


def test_list_group_users_unknown_group() -> None:
    cid = _bootstrap_super_admin("owner@test.invalid", "ownerpass123")
    owner = _login("owner@test.invalid", "ownerpass123")
    r = client.get(
        "/auth/groups/00000000-0000-0000-0000-00000000dead/users",
        headers={"Authorization": f"Bearer {owner}"},
    )
    assert r.status_code == 404
    assert r.json()["detail"] == "Unknown group"
