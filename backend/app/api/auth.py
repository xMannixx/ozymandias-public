"""Google OAuth endpoints for connector authorization."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.google_oauth import GoogleOAuthForbiddenError, GoogleOAuthService
from app.auth.jwt import decode_access_token, get_current_user
from app.database import get_db, get_redis
from app.schemas.api_models import (
    GoogleAuthUrlResponse,
    GoogleStatusResponse,
    TokenLoginRequest,
    TokenLoginResponse,
)
from app.services.errors import ServiceError, ValidationError

STATE_PREFIX = "google_oauth_state:"
STATE_TTL_SECONDS = 300

router = APIRouter(tags=["auth"])


@router.get("/google/url", response_model=GoogleAuthUrlResponse)
async def google_auth_url(
    user_id: str = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
) -> GoogleAuthUrlResponse:
    """Create a short-lived OAuth state and return Google auth URL."""
    state = secrets.token_urlsafe(32)
    await redis.setex(f"{STATE_PREFIX}{state}", STATE_TTL_SECONDS, user_id)
    service = GoogleOAuthService()
    url = service.get_auth_url(state)
    return GoogleAuthUrlResponse(url=url)


@router.get("/google/callback")
async def google_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> RedirectResponse:
    """Validate OAuth state, exchange code for tokens, then redirect to settings."""
    if not isinstance(code, str) or not code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth code",
        )
    if not isinstance(state, str) or not state.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing OAuth state",
        )
    key = f"{STATE_PREFIX}{state}"
    state_user_id = await redis.get(key)
    if not isinstance(state_user_id, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        )
    await redis.delete(key)

    service = GoogleOAuthService()
    try:
        await service.handle_callback(code=code, state=state, user_id=state_user_id, db=db)
    except GoogleOAuthForbiddenError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except (ServiceError, ValidationError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return RedirectResponse(url="http://localhost:8080/settings?google=connected")


@router.get("/google/status", response_model=GoogleStatusResponse)
async def google_status(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GoogleStatusResponse:
    """Return whether Google OAuth tokens are connected for current user."""
    service = GoogleOAuthService()
    payload = await service.status(user_id=user_id, db=db)
    return GoogleStatusResponse(**payload)


@router.post("/google/disconnect")
async def google_disconnect(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Delete persisted Google OAuth tokens for current user."""
    service = GoogleOAuthService()
    await service.disconnect(user_id=user_id, db=db)
    return {"disconnected": True}


@router.post("/token", response_model=TokenLoginResponse)
async def token_login(payload: TokenLoginRequest) -> TokenLoginResponse:
    """Validate a local JWT developer token and log in."""
    try:
        decode_access_token(payload.token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc
    return TokenLoginResponse(access_token=payload.token)
