"""Tests for POST /invite/send-participant-emails (Resend integration mocked)."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.group_service import group_store
from app.services.survey_store import survey_store
from app.services.user_service import user_store

client = TestClient(create_app())


def _bootstrap_super_admin(username: str = "admin@test.invalid", password: str = "adminpass123") -> None:
    r = client.post("/auth/bootstrap", json={"username": username, "password": password})
    assert r.status_code == 201, r.text


def _login(username: str, password: str) -> str:
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def setup_function() -> None:
    user_store.clear()
    group_store.clear()
    survey_store.clear()


def test_invite_send_503_when_resend_key_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    _bootstrap_super_admin("i503@test.invalid", "secretpass12")
    token = _login("i503@test.invalid", "secretpass12")
    r = client.post(
        "/invite/send-participant-emails",
        headers={"Authorization": f"Bearer {token}"},
        json={"recipients": [{"email": "a@example.com", "otp": ""}]},
    )
    assert r.status_code == 503
    assert "RESEND_API_KEY" in r.json()["detail"]


def test_invite_send_returns_sent_and_calls_resend(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RESEND_API_KEY", "re_test_fake_key")
    _bootstrap_super_admin("isend@test.invalid", "secretpass12")
    token = _login("isend@test.invalid", "secretpass12")

    async def fake_post(_client: httpx.AsyncClient, _payload: dict) -> httpx.Response:
        return httpx.Response(200, json={"id": "mock-id"})

    with (
        patch("app.services.invite_resend.post_resend_email", side_effect=fake_post),
        patch("app.services.invite_resend.asyncio.sleep", new_callable=AsyncMock),
    ):
        r = client.post(
            "/invite/send-participant-emails",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "recipients": [
                    {"email": "one@test.invalid", "otp": "ABC12"},
                    {"email": "two@test.invalid", "otp": ""},
                ]
            },
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["sent"]) == 2
    assert body["failed"] == []
    for item in body["sent"]:
        assert item["email"].endswith("@test.invalid")
        assert item["link"].startswith("https://surveys.app/s/")


def test_invite_send_partial_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RESEND_API_KEY", "re_test_fake_key")
    _bootstrap_super_admin("ipart@test.invalid", "secretpass12")
    token = _login("ipart@test.invalid", "secretpass12")

    calls: list[str] = []

    async def fake_post(_client: httpx.AsyncClient, payload: dict) -> httpx.Response:
        to = payload["to"][0]
        calls.append(to)
        if to == "bad@test.invalid":
            return httpx.Response(422, json={"message": "invalid"})
        return httpx.Response(200, json={"id": "ok"})

    with (
        patch("app.services.invite_resend.post_resend_email", side_effect=fake_post),
        patch("app.services.invite_resend.asyncio.sleep", new_callable=AsyncMock),
    ):
        r = client.post(
            "/invite/send-participant-emails",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "recipients": [
                    {"email": "good@test.invalid", "otp": ""},
                    {"email": "bad@test.invalid", "otp": ""},
                ]
            },
        )
    assert r.status_code == 200
    body = r.json()
    assert len(body["sent"]) == 1
    assert len(body["failed"]) == 1
    assert body["failed"][0]["email"] == "bad@test.invalid"


def test_invite_send_requires_auth() -> None:
    _bootstrap_super_admin("iauth@test.invalid", "secretpass12")
    r = client.post(
        "/invite/send-participant-emails",
        json={"recipients": [{"email": "x@test.invalid", "otp": ""}]},
    )
    assert r.status_code == 403
