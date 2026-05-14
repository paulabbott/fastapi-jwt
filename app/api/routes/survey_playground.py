from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter(tags=["survey-playground"])

STATIC_DIR = Path(__file__).parent.parent.parent / "static"


@router.get("/survey-playground", response_class=FileResponse)
def survey_playground_page() -> FileResponse:
    return FileResponse(STATIC_DIR / "survey-playground.html")
