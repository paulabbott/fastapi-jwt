import os

from fastapi.testclient import TestClient

from app.main import create_app
from app.services.group_service import group_store
from app.services.survey_store import survey_store
from app.services.user_service import user_store

client = TestClient(create_app())

_SURVEY_TOKEN = os.environ["SURVEY_API_BEARER_TOKEN"]


def setup_function() -> None:
    user_store.clear()
    group_store.clear()
    survey_store.clear()


def _survey_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_SURVEY_TOKEN}"}


def test_survey_routes_require_auth() -> None:
    r = client.get("/surveys")
    assert r.status_code == 403


def test_submit_answer_requires_survey_bearer() -> None:
    r = client.post("/deploys/does-not-exist/answers", json={"answer_json": {}})
    assert r.status_code == 403


def test_create_and_list_survey() -> None:
    h = _survey_headers()

    r = client.get("/surveys", headers=h)
    assert r.status_code == 200
    assert r.json() == []

    r = client.post(
        "/surveys",
        headers=h,
        json={"title": "T1", "survey_json": {"a": 1}},
    )
    assert r.status_code == 201
    sid = r.json()["survey_id"]

    r = client.get("/surveys", headers=h)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["survey_id"] == sid
    assert r.json()[0]["title"] == "T1"

    r = client.post(f"/surveys/{sid}/deploys", headers=h, json={})
    assert r.status_code == 201
    did = r.json()["deploy_id"]

    r = client.post(
        f"/deploys/{did}/answers",
        json={"answer_json": {"ok": True}},
    )
    assert r.status_code == 403

    r = client.post(
        f"/deploys/{did}/answers",
        headers=h,
        json={"answer_json": {"ok": True}},
    )
    assert r.status_code == 201
    assert "answer_id" in r.json()

    r = client.get(f"/deploys/{did}/answers", headers=h)
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_survey_bearer_rejects_app_jwt() -> None:
    user_store.clear()
    group_store.clear()
    survey_store.clear()
    assert client.post("/auth/bootstrap", json={"username": "jwt@test.invalid", "password": "jwtpass123"}).status_code == 201
    r2 = client.post("/auth/login", json={"username": "jwt@test.invalid", "password": "jwtpass123"})
    assert r2.status_code == 200
    jwt_token = r2.json()["access_token"]

    r3 = client.get("/surveys", headers={"Authorization": f"Bearer {jwt_token}"})
    assert r3.status_code == 401
    assert r3.json()["detail"] == "Invalid survey API token"
