"""Resend-backed participant invite emails (PoC).

TODO: Issue real magic links from the surveys API instead of ``random_test_magic_link``.
"""

from __future__ import annotations

import asyncio
import html
import secrets
from typing import Any

import httpx

from app.core.config import get_settings

RESEND_API_URL = "https://api.resend.com/emails"
# Default Resend limit is 5 req/s per team; stay slightly under with pacing + 429 backoff.
_MIN_INTERVAL_SEC = 0.22
_MAX_SEND_RETRIES = 4


def random_test_magic_link() -> str:
    """PoC placeholder link until the surveys API returns signed URLs."""
    tok = secrets.token_urlsafe(9).replace("-", "").replace("_", "")[:12].lower()
    return f"https://surveys.app/s/{tok}"


def _build_invite_html(magic_link: str, otp_plain: str) -> str:
    otp_html = ""
    if otp_plain.strip():
        safe_otp = html.escape(otp_plain.strip(), quote=True)
        otp_html = f"<p>Your one time password is: <strong>{safe_otp}</strong></p>"
    safe_link = html.escape(magic_link, quote=True)
    return (
        "<p>Hi,</p>"
        "<p>You've been invited to take part in a survey. Click the link below to begin:</p>"
        f'<p><a href="{safe_link}">{safe_link}</a></p>'
        f"{otp_html}"
        "<p>This link is unique to you. Please do not share it.</p>"
        "<p>Thanks,<br>The Survey Team</p>"
    )


async def post_resend_email(client: httpx.AsyncClient, payload: dict[str, Any]) -> httpx.Response:
    """POST one message to Resend (patch in tests)."""
    settings = get_settings()
    return await client.post(
        RESEND_API_URL,
        json=payload,
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )


async def send_participant_invites(
    recipients: list[tuple[str, str]],
    *,
    subject: str = "You've been invited to complete a survey",
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """
    Send one personalized email per recipient (unique magic link each).

    Returns (sent, failed) where each item is {"email": ..., "link": ...} or {"email": ..., "detail": ...}.
    """
    settings = get_settings()
    if not settings.resend_api_key.strip():
        raise RuntimeError("RESEND_API_KEY is not configured")

    sent: list[dict[str, str]] = []
    failed: list[dict[str, str]] = []
    from_addr = settings.resend_from.strip() or "onboarding@resend.dev"

    async with httpx.AsyncClient() as client:
        for email, otp in recipients:
            email = email.strip()
            if not email:
                failed.append({"email": email, "detail": "empty email"})
                continue

            magic_link = random_test_magic_link()
            payload = {
                "from": f"Survey Invites <{from_addr}>",
                "to": [email],
                "subject": subject,
                "html": _build_invite_html(magic_link, otp),
            }

            attempt = 0
            while attempt < _MAX_SEND_RETRIES:
                attempt += 1
                resp = await post_resend_email(client, payload)
                if resp.status_code == 429:
                    wait = float(resp.headers.get("retry-after") or "1.0")
                    await asyncio.sleep(wait)
                    continue
                if 200 <= resp.status_code < 300:
                    sent.append({"email": email, "link": magic_link})
                    break
                detail = resp.text
                try:
                    body = resp.json()
                    if isinstance(body, dict) and body.get("message"):
                        detail = str(body["message"])
                except Exception:
                    pass
                failed.append({"email": email, "detail": detail[:500]})
                break
            else:
                # Exited without ``break`` (still 429 after ``_MAX_SEND_RETRIES`` attempts).
                failed.append({"email": email, "detail": "rate limited after retries"})

            await asyncio.sleep(_MIN_INTERVAL_SEC)

    return sent, failed
