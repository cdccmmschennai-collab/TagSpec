"""FastAPI application entrypoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers

# Ensure models are imported so metadata is populated for Alembic / tooling.
import app.models  # noqa: F401,E402


def create_app() -> FastAPI:
    settings.ensure_storage_dirs()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    # Top-level health (spec requires GET /health and GET /api/v1/health).
    @app.get("/health", tags=["health"])
    def root_health() -> dict:
        return {"status": "ok", "service": settings.app_name}

    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
