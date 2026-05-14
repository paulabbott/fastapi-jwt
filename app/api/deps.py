import hmac
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.security import decode_token_payload
from app.services.user_service import user_store

security = HTTPBearer()
survey_api_security = HTTPBearer()


@dataclass(frozen=True)
class StaffContext:
    username: str
    group: str
    role: str


def _staff_from_valid_token(token: str) -> StaffContext:
    """Decode app JWT, require ``group`` claim, match user store."""
    payload = decode_token_payload(token)
    username = str(payload["sub"])
    role = str(payload.get("role") or "")
    group = str(payload.get("group") or "")
    if not group:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    if not user_store.exists(username):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or no longer active",
        )
    if user_store.get_group(username) != group:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    return StaffContext(username=username, group=group, role=role)


def get_staff_context(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> StaffContext:
    return _staff_from_valid_token(credentials.credentials)


def get_current_username(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    return _staff_from_valid_token(credentials.credentials).username


_INVITE_EMAIL_ROLES = frozenset({"super_admin", "survey_creator", "survey_runner"})


def require_invite_email_staff(
    ctx: StaffContext = Depends(get_staff_context),
) -> StaffContext:
    """Staff JWT roles allowed to trigger participant invite emails."""
    if ctx.role not in _INVITE_EMAIL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admin, survey_creator, or survey_runner may send invite emails",
        )
    return ctx


def require_super_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> StaffContext:
    ctx = _staff_from_valid_token(credentials.credentials)
    if ctx.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super_admins can perform this action",
        )
    return ctx


def verify_survey_api_bearer(
    credentials: HTTPAuthorizationCredentials = Depends(survey_api_security),
) -> None:
    """Survey REST API: Bearer must match SURVEY_API_BEARER_TOKEN (not app JWT)."""
    expected = get_settings().survey_api_bearer_token
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SURVEY_API_BEARER_TOKEN is not configured",
        )
    got = credentials.credentials.encode("utf-8")
    exp = expected.encode("utf-8")
    if len(got) != len(exp) or not hmac.compare_digest(got, exp):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid survey API token",
        )
