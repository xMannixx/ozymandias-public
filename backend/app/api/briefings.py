"""Daily briefing endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.models.briefing import Briefing
from app.schemas.api_models import BriefingResponse, BriefingSectionResponse
from app.services.briefing_service import BriefingService

router = APIRouter(tags=["briefings"])


@router.get("/latest", response_model=BriefingResponse | None)
async def get_latest_briefing(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BriefingResponse | None:
    """Return the most recent briefing, or null before the first one exists."""
    briefing = await BriefingService(db).latest(user_id=user_id)
    if briefing is None:
        return None
    return _to_response(briefing)


def _to_response(briefing: Briefing) -> BriefingResponse:
    payload = briefing.payload if isinstance(briefing.payload, dict) else {}
    raw_sections = payload.get("sections", [])
    sections = [_to_section(section) for section in raw_sections if isinstance(section, dict)]
    return BriefingResponse(
        briefing_id=str(briefing.briefing_id),
        briefing_date=briefing.briefing_date,
        content=briefing.content,
        sections=sections,
        created_at=briefing.created_at,
    )


def _to_section(section: dict[str, Any]) -> BriefingSectionResponse:
    items = [str(item) for item in section.get("items", []) if isinstance(item, str)]
    return BriefingSectionResponse(
        key=str(section.get("key", "")),
        title=str(section.get("title", "")),
        items=items,
        total=int(section.get("total", len(items))),
    )
