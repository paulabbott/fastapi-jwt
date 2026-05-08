from fastapi import FastAPI

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.playground import router as playground_router
from app.api.routes.protected import router as protected_router


def create_app() -> FastAPI:
    app = FastAPI(title="FastAPI JWT Service", version="1.0.0")
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(protected_router)
    app.include_router(playground_router)
    return app


app = create_app()
