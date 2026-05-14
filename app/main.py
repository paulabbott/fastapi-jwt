from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.home import router as home_router
from app.api.routes.invite_email import router as invite_email_router
from app.api.routes.playground import router as playground_router
from app.api.routes.protected import router as protected_router
from app.api.routes.survey import router as survey_router
from app.api.routes.survey_playground import router as survey_playground_router
from app.demo_workspace_groups import ensure_demo_workspace_groups


def create_app() -> FastAPI:
    app = FastAPI(title="FastAPI JWT Service", version="1.0.0")
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
    app.include_router(health_router)
    app.include_router(home_router)
    app.include_router(auth_router)
    app.include_router(invite_email_router)
    app.include_router(protected_router)
    app.include_router(survey_router)
    app.include_router(playground_router)
    app.include_router(survey_playground_router)
    ensure_demo_workspace_groups()
    return app


app = create_app()
