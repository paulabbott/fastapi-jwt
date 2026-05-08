from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter(tags=["home"])


@router.get("/", response_class=FileResponse)
def home() -> FileResponse:
    return FileResponse("app/static/index.html")
