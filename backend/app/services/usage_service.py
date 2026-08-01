"""Recording and aggregation of LLM usage events."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usage import LLMUsageEvent
from app.schemas import Channel, Sensitivity
from app.services.llm.pricing import cost_usd
from app.services.llm.usage import LLMCallUsage
from app.services.utils import normalize_user_id


def _optional_uuid(value: str | uuid.UUID | None) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


class UsageService:
    """Persist what LLM calls consumed and report it back per time range."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def record_calls(
        self,
        records: Sequence[LLMCallUsage],
        *,
        user_id: str,
        channel: Channel,
        sensitivity: Sensitivity,
        turn_id: str | None = None,
        conversation_id: str | uuid.UUID | None = None,
        project_id: str | uuid.UUID | None = None,
    ) -> int:
        """Store one row per collected call and return how many were written."""
        if not records:
            return 0
        normalized_user_id = normalize_user_id(user_id)
        conversation_uuid = _optional_uuid(conversation_id)
        project_uuid = _optional_uuid(project_id)
        for record in records:
            self.db.add(
                LLMUsageEvent(
                    user_id=normalized_user_id,
                    turn_id=turn_id,
                    conversation_id=conversation_uuid,
                    project_id=project_uuid,
                    call_type=record.call_type,
                    tool_name=record.tool_name,
                    channel=channel.value,
                    provider=record.provider,
                    model=record.model,
                    sensitivity=sensitivity.value,
                    prompt_tokens=record.prompt_tokens,
                    completion_tokens=record.completion_tokens,
                    cached_prompt_tokens=record.cached_prompt_tokens,
                    total_tokens=record.total_tokens,
                    latency_ms=record.latency_ms,
                    cost_usd=cost_usd(
                        provider=record.provider,
                        model=record.model,
                        prompt_tokens=record.prompt_tokens,
                        completion_tokens=record.completion_tokens,
                        cached_prompt_tokens=record.cached_prompt_tokens,
                    ),
                    status=record.status,
                    error_kind=record.error_kind,
                )
            )
        await self.db.commit()
        return len(records)
