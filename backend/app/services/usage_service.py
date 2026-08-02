"""Recording and aggregation of LLM usage events."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import Select, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from app.models.conversation import ConversationMessage
from app.models.usage import LLMUsageEvent
from app.schemas import Channel, Sensitivity
from app.schemas.api_models import (
    UsageBreakdownItem,
    UsageBucket,
    UsageCount,
    UsageRangeLiteral,
    UsageReport,
    UsageTotals,
)
from app.services.llm.pricing import cost_usd
from app.services.llm.usage import (
    CACHE_REPORTING_PROVIDERS,
    CALL_TYPE_TOOL,
    STATUS_ERROR,
    LLMCallUsage,
)
from app.services.utils import normalize_user_id

_RANGE_WINDOWS: dict[str, timedelta | None] = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "all": None,
}

_TOP_LIST_LIMIT = 8


def _optional_uuid(value: str | uuid.UUID | None) -> uuid.UUID | None:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _as_int(value: Any) -> int:
    return int(value) if value is not None else 0


def _as_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(str(value))


def _ratio(numerator: float, denominator: float) -> float | None:
    """Divide, or say nothing rather than pretend a rate exists."""
    if denominator <= 0:
        return None
    return numerator / denominator


def _throughput(
    tokens: int,
    *,
    first_call_at: datetime | None,
    last_call_at: datetime | None,
) -> float | None:
    """Tokens per minute across the measured window, not across the range.

    A single call spans no time, so throughput stays unreported until there
    are at least two calls apart from each other.
    """
    if first_call_at is None or last_call_at is None:
        return None
    minutes = (last_call_at - first_call_at).total_seconds() / 60
    if minutes <= 0:
        return None
    return tokens / minutes


@dataclass(frozen=True)
class _CallAggregate:
    """Raw sums over the usage events of one range."""

    calls: int = 0
    failed: int = 0
    tool_calls: int = 0
    unpriced: int = 0
    tokens_total: int = 0
    tokens_input: int = 0
    tokens_output: int = 0
    tokens_cached: int = 0
    cost_usd: float = 0.0
    avg_latency_ms: float | None = None
    first_call_at: datetime | None = None
    last_call_at: datetime | None = None

    @classmethod
    def from_row(cls, row: Any) -> _CallAggregate:
        if row is None:
            return cls()
        return cls(
            calls=_as_int(row[0]),
            tokens_total=_as_int(row[1]),
            tokens_input=_as_int(row[2]),
            tokens_output=_as_int(row[3]),
            tokens_cached=_as_int(row[4]),
            failed=_as_int(row[5]),
            tool_calls=_as_int(row[6]),
            unpriced=_as_int(row[7]),
            cost_usd=_as_float(row[8]),
            avg_latency_ms=float(row[9]) if row[9] is not None else None,
            first_call_at=row[10],
            last_call_at=row[11],
        )


@dataclass(frozen=True)
class _MessageAggregate:
    """Message and session counts of one range."""

    user: int = 0
    assistant: int = 0
    sessions: int = 0
    #: Assistant messages that have usage behind them, so averages stay honest
    #: for a range that reaches back before the first recorded call.
    assistant_measured: int = 0


def build_totals(
    *,
    calls: _CallAggregate,
    messages: _MessageAggregate,
    cache_hit_rate: float | None,
) -> UsageTotals:
    """Derive the headline numbers from raw sums.

    Averages are per assistant message, because that is the unit a reader
    thinks in: one answer Ozy gave. Only answers given after recording began
    count, otherwise older chats would drag every average down.
    """
    return UsageTotals(
        messages_total=messages.user + messages.assistant,
        messages_user=messages.user,
        messages_assistant=messages.assistant,
        sessions=messages.sessions,
        calls=calls.calls,
        calls_failed=calls.failed,
        error_rate=_ratio(calls.failed, calls.calls) or 0.0,
        tool_calls=calls.tool_calls,
        tokens_total=calls.tokens_total,
        tokens_input=calls.tokens_input,
        tokens_output=calls.tokens_output,
        tokens_cached=calls.tokens_cached,
        tokens_per_minute=_throughput(
            calls.tokens_total,
            first_call_at=calls.first_call_at,
            last_call_at=calls.last_call_at,
        ),
        avg_tokens_per_message=_ratio(calls.tokens_total, messages.assistant_measured),
        cache_hit_rate=cache_hit_rate,
        avg_latency_ms=round(calls.avg_latency_ms) if calls.avg_latency_ms is not None else None,
        cost_usd=calls.cost_usd,
        avg_cost_per_message=_ratio(calls.cost_usd, messages.assistant_measured),
        unpriced_calls=calls.unpriced,
        first_call_at=calls.first_call_at,
        last_call_at=calls.last_call_at,
    )


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

    async def get_report(self, *, user_id: str, range_key: UsageRangeLiteral) -> UsageReport:
        """Aggregate one time range into the numbers the usage page shows."""
        normalized_user_id = normalize_user_id(user_id)
        now = datetime.now(UTC)
        window = _RANGE_WINDOWS.get(range_key, timedelta(hours=24))
        since = now - window if window is not None else None
        bucket_unit: Literal["hour", "day"] = "hour" if range_key == "24h" else "day"

        totals = await self._totals(
            normalized_user_id=normalized_user_id,
            since=since,
        )
        cost_total = totals.cost_usd
        return UsageReport(
            range=range_key,
            since=since,
            generated_at=now,
            bucket_unit=bucket_unit,
            totals=totals,
            top_models=await self._breakdown(
                LLMUsageEvent.model,
                normalized_user_id=normalized_user_id,
                since=since,
                cost_total=cost_total,
            ),
            top_providers=await self._breakdown(
                LLMUsageEvent.provider,
                normalized_user_id=normalized_user_id,
                since=since,
                cost_total=cost_total,
            ),
            top_tools=await self._breakdown(
                LLMUsageEvent.tool_name,
                normalized_user_id=normalized_user_id,
                since=since,
                cost_total=cost_total,
                skip_null_keys=True,
            ),
            top_channels=await self._breakdown(
                LLMUsageEvent.channel,
                normalized_user_id=normalized_user_id,
                since=since,
                cost_total=cost_total,
            ),
            top_call_types=await self._breakdown(
                LLMUsageEvent.call_type,
                normalized_user_id=normalized_user_id,
                since=since,
                cost_total=cost_total,
            ),
            errors_by_kind=await self._errors_by_kind(
                normalized_user_id=normalized_user_id,
                since=since,
            ),
            errors_by_day=await self._errors_by_unit(
                "day",
                normalized_user_id=normalized_user_id,
                since=since,
            ),
            errors_by_hour=await self._errors_by_unit(
                "hour",
                normalized_user_id=normalized_user_id,
                since=since,
            ),
            series=await self._series(
                bucket_unit,
                normalized_user_id=normalized_user_id,
                since=since,
            ),
        )

    def _in_range(
        self,
        statement: Select[Any],
        *,
        normalized_user_id: uuid.UUID,
        since: datetime | None,
    ) -> Select[Any]:
        statement = statement.where(LLMUsageEvent.user_id == normalized_user_id)
        if since is not None:
            statement = statement.where(LLMUsageEvent.created_at >= since)
        return statement

    async def _totals(
        self,
        *,
        normalized_user_id: uuid.UUID,
        since: datetime | None,
    ) -> UsageTotals:
        errors = func.sum(case((LLMUsageEvent.status == STATUS_ERROR, 1), else_=0))
        tool_calls = func.sum(case((LLMUsageEvent.call_type == CALL_TYPE_TOOL, 1), else_=0))
        unpriced = func.sum(case((LLMUsageEvent.cost_usd.is_(None), 1), else_=0))
        stmt = self._in_range(
            select(
                func.count(),
                func.coalesce(func.sum(LLMUsageEvent.total_tokens), 0),
                func.coalesce(func.sum(LLMUsageEvent.prompt_tokens), 0),
                func.coalesce(func.sum(LLMUsageEvent.completion_tokens), 0),
                func.coalesce(func.sum(LLMUsageEvent.cached_prompt_tokens), 0),
                func.coalesce(errors, 0),
                func.coalesce(tool_calls, 0),
                func.coalesce(unpriced, 0),
                func.coalesce(func.sum(LLMUsageEvent.cost_usd), 0),
                func.avg(LLMUsageEvent.latency_ms),
                func.min(LLMUsageEvent.created_at),
                func.max(LLMUsageEvent.created_at),
            ).select_from(LLMUsageEvent),
            normalized_user_id=normalized_user_id,
            since=since,
        )
        row = (await self.db.execute(stmt)).first()
        calls = _CallAggregate.from_row(row)
        messages = await self._message_metrics(
            normalized_user_id=normalized_user_id,
            since=since,
        )
        cache_hit_rate = await self._cache_hit_rate(
            normalized_user_id=normalized_user_id,
            since=since,
        )
        return build_totals(calls=calls, messages=messages, cache_hit_rate=cache_hit_rate)

    async def _message_metrics(
        self,
        *,
        normalized_user_id: uuid.UUID,
        since: datetime | None,
    ) -> _MessageAggregate:
        """Count user and assistant messages plus the sessions they happened in."""
        conditions: list[ColumnElement[bool]] = [ConversationMessage.user_id == normalized_user_id]
        if since is not None:
            conditions.append(ConversationMessage.created_at >= since)
        role_stmt = (
            select(ConversationMessage.role, func.count())
            .where(*conditions)
            .group_by(ConversationMessage.role)
        )
        rows = (await self.db.execute(role_stmt)).all()
        by_role = {str(role): _as_int(count) for role, count in rows}

        session_stmt = select(func.count(func.distinct(ConversationMessage.conversation_id))).where(
            *conditions
        )
        sessions = _as_int((await self.db.execute(session_stmt)).scalar_one_or_none())
        assistant = by_role.get("assistant", 0)
        return _MessageAggregate(
            user=by_role.get("user", 0),
            assistant=assistant,
            sessions=sessions,
            assistant_measured=await self._measured_answers(
                normalized_user_id=normalized_user_id,
                since=since,
            ),
        )

    async def _measured_answers(
        self,
        *,
        normalized_user_id: uuid.UUID,
        since: datetime | None,
    ) -> int:
        """Answers whose turn actually left usage records behind.

        Chats from before recording began keep counting as messages, but they
        must not dilute the per-answer averages.
        """
        measured_turns = self._in_range(
            select(LLMUsageEvent.turn_id)
            .select_from(LLMUsageEvent)
            .where(LLMUsageEvent.turn_id.is_not(None))
            .distinct(),
            normalized_user_id=normalized_user_id,
            since=since,
        )
        stmt = select(func.count()).where(
            ConversationMessage.user_id == normalized_user_id,
            ConversationMessage.role == "assistant",
            ConversationMessage.turn_id.in_(measured_turns),
        )
        return _as_int((await self.db.execute(stmt)).scalar_one_or_none())

    async def _cache_hit_rate(
        self,
        *,
        normalized_user_id: uuid.UUID,
        since: datetime | None,
    ) -> float | None:
        """Cached share of input tokens, only over providers that report caching."""
        stmt = self._in_range(
            select(
                func.coalesce(func.sum(LLMUsageEvent.prompt_tokens), 0),
                func.coalesce(func.sum(LLMUsageEvent.cached_prompt_tokens), 0),
            )
            .select_from(LLMUsageEvent)
            .where(LLMUsageEvent.provider.in_(sorted(CACHE_REPORTING_PROVIDERS))),
            normalized_user_id=normalized_user_id,
            since=since,
        )
        row = (await self.db.execute(stmt)).first()
        if row is None:
            return None
        prompt_tokens, cached_tokens = _as_int(row[0]), _as_int(row[1])
        return _ratio(cached_tokens, prompt_tokens)

    async def _breakdown(
        self,
        column: InstrumentedAttribute[str] | InstrumentedAttribute[str | None],
        *,
        normalized_user_id: uuid.UUID,
        since: datetime | None,
        cost_total: float,
        skip_null_keys: bool = False,
    ) -> list[UsageBreakdownItem]:
        stmt = self._in_range(
            select(
                column,
                func.count(),
                func.coalesce(func.sum(LLMUsageEvent.total_tokens), 0),
                func.coalesce(func.sum(LLMUsageEvent.cost_usd), 0),
            ).select_from(LLMUsageEvent),
            normalized_user_id=normalized_user_id,
            since=since,
        )
        if skip_null_keys:
            stmt = stmt.where(column.is_not(None))
        stmt = stmt.group_by(column).order_by(func.count().desc()).limit(_TOP_LIST_LIMIT)
        rows = (await self.db.execute(stmt)).all()
        items: list[UsageBreakdownItem] = []
        for key, calls, tokens, cost in rows:
            item_cost = _as_float(cost)
            items.append(
                UsageBreakdownItem(
                    key=str(key) if key is not None else "unknown",
                    calls=_as_int(calls),
                    tokens=_as_int(tokens),
                    cost_usd=item_cost,
                    cost_share=_ratio(item_cost, cost_total) or 0.0,
                )
            )
        return items

    async def _errors_by_kind(
        self,
        *,
        normalized_user_id: uuid.UUID,
        since: datetime | None,
    ) -> list[UsageCount]:
        stmt = self._in_range(
            select(LLMUsageEvent.error_kind, func.count())
            .select_from(LLMUsageEvent)
            .where(LLMUsageEvent.status == STATUS_ERROR),
            normalized_user_id=normalized_user_id,
            since=since,
        )
        stmt = stmt.group_by(LLMUsageEvent.error_kind).order_by(func.count().desc())
        rows = (await self.db.execute(stmt)).all()
        return [
            UsageCount(label=str(kind) if kind else "unknown", count=_as_int(count))
            for kind, count in rows
        ]

    async def _errors_by_unit(
        self,
        unit: str,
        *,
        normalized_user_id: uuid.UUID,
        since: datetime | None,
    ) -> list[UsageCount]:
        """Failed calls per calendar day or per hour of day."""
        if unit == "hour":
            label_column = func.to_char(LLMUsageEvent.created_at, "HH24:00")
        else:
            label_column = func.to_char(LLMUsageEvent.created_at, "YYYY-MM-DD")
        stmt = self._in_range(
            select(label_column, func.count())
            .select_from(LLMUsageEvent)
            .where(LLMUsageEvent.status == STATUS_ERROR),
            normalized_user_id=normalized_user_id,
            since=since,
        )
        stmt = stmt.group_by(label_column).order_by(label_column.asc())
        rows = (await self.db.execute(stmt)).all()
        return [UsageCount(label=str(label), count=_as_int(count)) for label, count in rows]

    async def _series(
        self,
        bucket_unit: str,
        *,
        normalized_user_id: uuid.UUID,
        since: datetime | None,
    ) -> list[UsageBucket]:
        bucket = func.date_trunc(bucket_unit, LLMUsageEvent.created_at)
        errors = func.sum(case((LLMUsageEvent.status == STATUS_ERROR, 1), else_=0))
        stmt = self._in_range(
            select(
                bucket,
                func.count(),
                func.coalesce(func.sum(LLMUsageEvent.total_tokens), 0),
                func.coalesce(func.sum(LLMUsageEvent.cost_usd), 0),
                func.coalesce(errors, 0),
            ).select_from(LLMUsageEvent),
            normalized_user_id=normalized_user_id,
            since=since,
        )
        stmt = stmt.group_by(bucket).order_by(bucket.asc())
        rows = (await self.db.execute(stmt)).all()
        return [
            UsageBucket(
                bucket=bucket_at,
                calls=_as_int(calls),
                tokens=_as_int(tokens),
                cost_usd=_as_float(cost),
                errors=_as_int(error_count),
            )
            for bucket_at, calls, tokens, cost, error_count in rows
        ]
