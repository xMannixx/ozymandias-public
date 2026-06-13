"""Dashboard stats endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db, get_redis
from app.schemas.api_models import DashboardStats
from app.services.stats_service import StatsService

router = APIRouter(tags=["stats"])


@router.get("", response_model=DashboardStats)
async def get_dashboard_stats(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> DashboardStats:
    """Return aggregated dashboard metrics for the current user."""
    service = StatsService(db, redis)
    return await service.get_dashboard_stats(user_id=user_id)
