"""Who the nightly jobs run for.

Celery beat triggers maintenance without a user in hand, while the services
underneath are all scoped to one user. This resolves the gap from the data:
every user that has stored claims gets maintained.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim


async def user_ids_with_claims(db: AsyncSession) -> list[str]:
    """Distinct users with at least one stored claim."""
    result = await db.execute(select(Claim.user_id).distinct())
    return [str(user_id) for user_id in result.scalars().all() if user_id is not None]
