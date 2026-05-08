from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_username
from app.core.security import create_access_token
from app.schemas.auth import TokenResponse, UserCredentials
from app.services.user_service import user_store

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserCredentials) -> TokenResponse:
    if user_store.exists(user.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists",
        )

    user_store.register(user.username, user.password)
    token = create_access_token(user.username)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(user: UserCredentials) -> TokenResponse:
    if not user_store.validate_credentials(user.username, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token(user.username)
    return TokenResponse(access_token=token)


@router.get("/users")
def list_users(_: str = Depends(get_current_username)) -> dict[str, list[str]]:
    return {"users": user_store.list_usernames()}
