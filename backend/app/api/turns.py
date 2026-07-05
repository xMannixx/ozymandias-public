"""Turn endpoints."""

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.schemas.api_models import TurnRequest, TurnResult
from app.services.errors import (
    CircuitBreakerTrippedError,
    LiveWebPermissionRequiredError,
    LocalProviderUnavailableError,
    NotFoundError,
    ServiceError,
)
from app.services.turn_service import TurnService

router = APIRouter(tags=["turns"])


@router.post("", response_model=TurnResult)
async def process_turn(
    payload: TurnRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TurnResult:
    service = TurnService(db)
    try:
        return await service.process_turn(user_id=user_id, payload=payload)
    except LocalProviderUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "local_provider_unavailable",
                "message": str(exc),
                "provider": exc.provider,
                "sensitivity": exc.sensitivity,
                "fallback_allowed": exc.fallback_allowed,
            },
        ) from exc
    except LiveWebPermissionRequiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "live_web_confirmation_required",
                "message": str(exc),
                "sensitivity": exc.sensitivity,
            },
        ) from exc
    except CircuitBreakerTrippedError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ServiceError as exc:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=str(exc)) from exc


@router.post("/stream")
async def process_turn_stream(
    payload: TurnRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Stream a turn as server-sent events: delta, result and error."""
    service = TurnService(db)

    async def event_source() -> AsyncIterator[str]:
        async for event in service.process_turn_stream(user_id=user_id, payload=payload):
            data = json.dumps(event["data"], ensure_ascii=False)
            yield f"event: {event['event']}\ndata: {data}\n\n"

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Nginx: never buffer SSE responses.
            "X-Accel-Buffering": "no",
        },
    )
