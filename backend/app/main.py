"""FastAPI application factory for Ozymandias."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.calendar import router as calendar_router
from app.api.claims import router as claims_router
from app.api.contacts import router as contacts_router
from app.api.files import router as files_router
from app.api.health import router as health_router
from app.api.llm import router as llm_router
from app.api.mail import router as mail_router
from app.api.memory import router as memory_router
from app.api.projects import router as projects_router
from app.api.proposals import router as proposals_router
from app.api.settings import router as settings_router
from app.api.stats import router as stats_router
from app.api.turns import router as turns_router
from app.api.voice import router as voice_router
from app.config import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Application lifespan hook."""
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI app."""
    settings = get_settings()
    app = FastAPI(
        title="Ozymandias",
        version="0.1.0",
        debug=settings.debug,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(audit_router, prefix="/audit")
    app.include_router(auth_router, prefix="/auth")
    app.include_router(calendar_router, prefix="/calendar")
    app.include_router(claims_router, prefix="/claims")
    app.include_router(contacts_router, prefix="/contacts")
    app.include_router(proposals_router, prefix="/proposals")
    app.include_router(projects_router, prefix="/projects")
    app.include_router(mail_router, prefix="/mail")
    app.include_router(memory_router, prefix="/memory")
    app.include_router(files_router, prefix="/files")
    app.include_router(llm_router, prefix="/llm")
    app.include_router(stats_router, prefix="/stats")
    app.include_router(settings_router, prefix="/settings")
    app.include_router(turns_router, prefix="/turns")
    app.include_router(voice_router, prefix="/voice")
    return app
