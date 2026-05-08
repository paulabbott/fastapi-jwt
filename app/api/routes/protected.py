from fastapi import APIRouter, Depends

from app.api.deps import get_current_username

router = APIRouter(tags=["protected"])


@router.get("/protected")
def protected(username: str = Depends(get_current_username)) -> dict[str, str]:
    return {"message": f"Hello {username}"}
