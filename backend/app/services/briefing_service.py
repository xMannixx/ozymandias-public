"""Build the daily morning briefing.

Deterministic on purpose: no model writes this text. Mail subjects and calendar
entries are untrusted input, and pushing them through an LLM unattended at
seven in the morning is exactly the kind of thing the taint rules exist to
prevent. A template is also simply more reliable.

Every source is optional. No Google account, an expired token, an API that
times out — the affected section disappears and the rest of the briefing is
still written.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from celery import shared_task
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, run_db_job
from app.models.briefing import Briefing
from app.models.claim import Claim
from app.models.project import Project, ProjectTask
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.services.audit_service import AuditService
from app.services.calendar_service import CalendarService
from app.services.gmail_service import GmailService
from app.services.job_targets import user_ids_wanting_a_briefing
from app.services.proposal_service import ProposalService
from app.services.utils import normalize_user_id

logger = logging.getLogger(__name__)

#: A briefing is a glance, not a list. Everything beyond this is a summary line.
MAX_ITEMS_PER_SECTION = 5

#: A claim that runs out this week is worth a mention; next month is not.
EXPIRY_HORIZON_DAYS = 7


@dataclass(frozen=True)
class BriefingSection:
    """One block of the briefing: a heading and its lines."""

    key: str
    title: str
    items: list[str]
    #: Total before truncation, so the card can say "and 4 more".
    total: int


@dataclass(frozen=True)
class BriefingDraft:
    """The rendered briefing plus its structured form."""

    content: str
    payload: dict[str, Any]


class BriefingService:
    """Collect the day's facts and render them as one short text."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.audit = AuditService(db)

    async def create_for_user(self, *, user_id: str, on_date: date) -> Briefing | None:
        """Write today's briefing, or return ``None`` if it already exists."""
        existing = await self.get_for_date(user_id=user_id, on_date=on_date)
        if existing is not None:
            return existing

        draft = await self.build(user_id=user_id, on_date=on_date)
        briefing = Briefing(
            user_id=normalize_user_id(user_id),
            briefing_date=on_date,
            content=draft.content,
            payload=draft.payload,
        )
        self.db.add(briefing)
        await self.db.commit()
        await self.db.refresh(briefing)
        await self.audit.log(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            user_id=user_id,
            channel=Channel.celery,
            actor="service:briefing",
            target_id=str(briefing.briefing_id),
            detail="Daily briefing created",
            payload={"sections": [section["key"] for section in draft.payload["sections"]]},
            source_ref="heartbeat",
            sensitivity=Sensitivity.S1,
        )
        return briefing

    async def get_for_date(self, *, user_id: str, on_date: date) -> Briefing | None:
        """The briefing of one day, if it was already written."""
        stmt = select(Briefing).where(
            Briefing.user_id == normalize_user_id(user_id),
            Briefing.briefing_date == on_date,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def latest(self, *, user_id: str) -> Briefing | None:
        """The most recent briefing, for the dashboard card."""
        stmt = (
            select(Briefing)
            .where(Briefing.user_id == normalize_user_id(user_id))
            .order_by(Briefing.briefing_date.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def build(self, *, user_id: str, on_date: date) -> BriefingDraft:
        """Gather every source and render the text."""
        sections = [
            section
            for section in [
                await self._calendar_section(user_id=user_id, on_date=on_date),
                await self._mail_section(user_id=user_id),
                await self._proposal_section(user_id=user_id),
                await self._memory_section(user_id=user_id),
                await self._task_section(user_id=user_id, on_date=on_date),
            ]
            if section is not None
        ]
        return BriefingDraft(
            content=_render(sections, on_date=on_date),
            payload={
                "date": on_date.isoformat(),
                "sections": [
                    {
                        "key": section.key,
                        "title": section.title,
                        "items": section.items,
                        "total": section.total,
                    }
                    for section in sections
                ],
            },
        )

    async def _calendar_section(self, *, user_id: str, on_date: date) -> BriefingSection | None:
        start = datetime.combine(on_date, time.min, tzinfo=UTC)
        try:
            events = await CalendarService(self.db).list_events(
                user_id=user_id,
                time_min=start,
                time_max=start + timedelta(days=1),
                max_results=20,
            )
        except Exception as exc:
            logger.info("briefing: calendar unavailable for %s: %s", user_id, exc)
            return None
        if not events:
            return None
        items = [
            f"{_clock(event.get('start'))} {event.get('summary') or 'Untitled event'}".strip()
            for event in events
        ]
        return _section("calendar", "Today's calendar", items)

    async def _mail_section(self, *, user_id: str) -> BriefingSection | None:
        try:
            messages = await GmailService(self.db).list_messages(
                user_id=user_id,
                max_results=10,
                query="is:unread newer_than:1d",
            )
        except Exception as exc:
            logger.info("briefing: mail unavailable for %s: %s", user_id, exc)
            return None
        if not messages:
            return None
        items = [
            f"{message.get('subject') or '(no subject)'} — {message.get('sender') or 'unknown'}"
            for message in messages
        ]
        return _section("mail", "Unread mail since yesterday", items)

    async def _proposal_section(self, *, user_id: str) -> BriefingSection | None:
        try:
            proposals = await ProposalService(self.db).list_proposals(
                user_id=user_id,
                status="pending",
            )
        except Exception as exc:
            logger.info("briefing: proposals unavailable for %s: %s", user_id, exc)
            return None
        if not proposals:
            return None
        items = [_proposal_line(proposal.proposed_claim) for proposal in proposals]
        return _section("proposals", "Proposals waiting for review", items)

    async def _memory_section(self, *, user_id: str) -> BriefingSection | None:
        horizon = datetime.now(tz=UTC) + timedelta(days=EXPIRY_HORIZON_DAYS)
        stmt = select(Claim).where(
            Claim.user_id == normalize_user_id(user_id),
            Claim.verification_state.notin_(["retracted", "superseded"]),
        )
        try:
            result = await self.db.execute(stmt)
            claims = list(result.scalars().all())
        except Exception as exc:
            logger.info("briefing: claims unavailable for %s: %s", user_id, exc)
            return None

        items = [
            f"{claim.content} ({_memory_reason(claim, horizon)})"
            for claim in claims
            if _memory_reason(claim, horizon) is not None
        ]
        if not items:
            return None
        return _section("memory", "Memory needing attention", items)

    async def _task_section(self, *, user_id: str, on_date: date) -> BriefingSection | None:
        stmt = (
            select(ProjectTask, Project.name)
            .join(Project, Project.project_id == ProjectTask.project_id)
            .where(
                ProjectTask.user_id == user_id,
                ProjectTask.status != "done",
                ProjectTask.due_date.is_not(None),
                ProjectTask.due_date <= on_date,
            )
            .order_by(ProjectTask.due_date)
        )
        try:
            result = await self.db.execute(stmt)
            rows = list(result.all())
        except Exception as exc:
            logger.info("briefing: tasks unavailable for %s: %s", user_id, exc)
            return None
        if not rows:
            return None
        items = [
            f"{project_name}: {task.name} (due {task.due_date.isoformat()})"
            for task, project_name in rows
        ]
        return _section("tasks", "Tasks due or overdue", items)


def _section(key: str, title: str, items: list[str]) -> BriefingSection:
    return BriefingSection(
        key=key,
        title=title,
        items=items[:MAX_ITEMS_PER_SECTION],
        total=len(items),
    )


def _memory_reason(claim: Claim, horizon: datetime) -> str | None:
    """Why this claim is worth a line today, or ``None`` if it is not."""
    if claim.review_due:
        return "review due"
    valid_to = claim.valid_to
    if valid_to is None:
        return None
    if valid_to.tzinfo is None:
        valid_to = valid_to.replace(tzinfo=UTC)
    if valid_to <= horizon:
        return f"expires {valid_to.date().isoformat()}"
    return None


def _proposal_line(proposed_claim: dict[str, Any]) -> str:
    content = proposed_claim.get("content") if isinstance(proposed_claim, dict) else None
    if isinstance(content, str) and content.strip():
        return content.strip()
    return "Proposal without a readable summary"


def _clock(value: Any) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).strftime("%H:%M")
    return ""


def _render(sections: list[BriefingSection], *, on_date: date) -> str:
    """Plain text, English, the same wording as the UI."""
    header = f"Briefing for {on_date.strftime('%A, %d %B %Y')}"
    if not sections:
        return f"{header}\n\nNothing needs your attention today."

    lines = [header, ""]
    for section in sections:
        lines.append(f"{section.title} ({section.total})")
        lines.extend(f"- {item}" for item in section.items)
        remaining = section.total - len(section.items)
        if remaining > 0:
            lines.append(f"- and {remaining} more")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


async def _run_heartbeat_job(user_id: str, *, on_date: date | None = None) -> str:
    async with AsyncSessionLocal() as db:
        briefing = await BriefingService(db).create_for_user(
            user_id=user_id,
            on_date=on_date or datetime.now(tz=UTC).date(),
        )
        return str(briefing.briefing_id) if briefing is not None else ""


async def _run_heartbeat_job_for_all() -> dict[str, str]:
    now = datetime.now(tz=UTC)
    async with AsyncSessionLocal() as db:
        user_ids = await user_ids_wanting_a_briefing(db, utc_hour=now.hour)
    return {user_id: await _run_heartbeat_job(user_id, on_date=now.date()) for user_id in user_ids}


@shared_task(name="ozy.heartbeat")  # type: ignore[untyped-decorator,misc,unused-ignore]
def run_heartbeat_task(user_id: str) -> str:
    """Celery task: write today's briefing for one user."""
    return run_db_job(_run_heartbeat_job(user_id))


@shared_task(name="ozy.heartbeat.run_all")  # type: ignore[untyped-decorator,misc,unused-ignore]
def run_heartbeat_all_task() -> dict[str, str]:
    """Beat entrypoint: brief everyone whose chosen hour just started."""
    return run_db_job(_run_heartbeat_job_for_all())
