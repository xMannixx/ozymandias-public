"""LLM usage reporting endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.schemas.api_models import UsageRangeLiteral, UsageReport
from app.services.usage_service import UsageService

router = APIRouter(tags=["usage"])


@router.get("", response_model=UsageReport)
async def get_usage_report(
    range_key: Annotated[
        UsageRangeLiteral,
        Query(alias="range", description="Time range to aggregate"),
    ] = "24h",
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UsageReport:
    """Return token, cost and error metrics of the current user's LLM calls."""
    return await UsageService(db).get_report(user_id=user_id, range_key=range_key)
