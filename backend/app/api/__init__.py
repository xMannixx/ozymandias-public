"""API routers package."""

from app.api.claims import router as claims_router
from app.api.health import router as health_router
from app.api.proposals import router as proposals_router
from app.api.turns import router as turns_router
from app.api.voice import router as voice_router

__all__ = [
    "claims_router",
    "health_router",
    "proposals_router",
    "turns_router",
    "voice_router",
]
