"""Who the nightly jobs run for.

Celery beat triggers maintenance without a user in hand, while the services
underneath are all scoped to one user. This resolves the gap from the data:
every user that has stored claims gets maintained.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim
from app.models.conversation import Conversation
from app.models.settings import UserSettings


async def user_ids_with_claims(db: AsyncSession) -> list[str]:
    """Distinct users with at least one stored claim."""
    result = await db.execute(select(Claim.user_id).distinct())
    return [str(user_id) for user_id in result.scalars().all() if user_id is not None]


async def user_ids_with_conversations(db: AsyncSession) -> list[str]:
    """Distinct users with at least one chat.

    Episode indexing follows conversations, not claims: someone can have
    chatted for weeks without a single claim ever being confirmed.
    """
    result = await db.execute(select(Conversation.user_id).distinct())
    return [str(user_id) for user_id in result.scalars().all() if user_id is not None]


async def user_ids_wanting_a_briefing(db: AsyncSession, *, utc_hour: int) -> list[str]:
    """Users whose briefing hour is the one that just started.

    The heartbeat runs hourly so everyone can pick their own time; this is what
    turns "it is 07:00 UTC" into the handful of users who asked for 07:00.
    """
    stmt = select(UserSettings.user_id).where(
        UserSettings.briefing_enabled.is_(True),
        UserSettings.briefing_hour == utc_hour,
    )
    result = await db.execute(stmt)
    return [str(user_id) for user_id in result.scalars().all() if user_id is not None]
