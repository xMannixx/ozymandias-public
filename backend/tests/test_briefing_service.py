"""Tests for building the daily briefing."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim
from app.models.project import ProjectTask
from app.models.proposal import MemoryProposal
from app.services.briefing_service import MAX_ITEMS_PER_SECTION, BriefingService
from app.services.calendar_service import CalendarService
from app.services.gmail_service import GmailService
from app.services.proposal_service import ProposalService
from tests.conftest import FakeAsyncSession, FakeQueryResult

USER_ID = str(uuid.uuid4())
TODAY = date(2026, 6, 15)


class _Sources:
    """Every external source of a briefing, each independently switchable."""

    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []
        self.messages: list[dict[str, Any]] = []
        self.proposals: list[MemoryProposal] = []
        self.calendar_error: Exception | None = None
        self.mail_error: Exception | None = None


def _install(monkeypatch: pytest.MonkeyPatch, sources: _Sources) -> None:
    async def _events(self: object, **kwargs: Any) -> list[dict[str, Any]]:
        del self, kwargs
        if sources.calendar_error is not None:
            raise sources.calendar_error
        return sources.events

    async def _messages(self: object, **kwargs: Any) -> list[dict[str, Any]]:
        del self, kwargs
        if sources.mail_error is not None:
            raise sources.mail_error
        return sources.messages

    async def _proposals(self: object, **kwargs: Any) -> list[MemoryProposal]:
        del self, kwargs
        return sources.proposals

    monkeypatch.setattr(CalendarService, "list_events", _events)
    monkeypatch.setattr(GmailService, "list_messages", _messages)
    monkeypatch.setattr(ProposalService, "list_proposals", _proposals)


def _service(
    *,
    claims: list[Claim] | None = None,
    tasks: list[tuple[ProjectTask, str]] | None = None,
) -> BriefingService:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=list(claims or [])))
    db.queue_execute_result(FakeQueryResult(values=list(tasks or [])))
    return BriefingService(cast(AsyncSession, db))


def _event(summary: str, hour: int) -> dict[str, Any]:
    return {
        "summary": summary,
        "start": datetime(2026, 6, 15, hour, 0, tzinfo=UTC),
    }


def _claim(content: str, *, review_due: bool = False, valid_to: datetime | None = None) -> Claim:
    return Claim(
        claim_id=uuid.uuid4(),
        user_id=uuid.UUID(USER_ID),
        subject="user:1",
        attribute="about",
        value=content,
        content=content,
        memory_type="profile",
        verification_state="confirmed",
        confidence=0.8,
        source_ref="turn-1",
        source_type="user_explicit",
        sensitivity="S1",
        trust_level="T3",
        handling_policy="local_preferred",
        user_locked=False,
        decay_eligible=True,
        lifecycle="temporary",
        valid_to=valid_to,
        review_due=review_due,
    )


def _task(name: str, *, due: date) -> tuple[ProjectTask, str]:
    task = ProjectTask(
        task_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id=USER_ID,
        name=name,
        status="open",
        priority="high",
        due_date=due,
    )
    return task, "Ozymandias"


def _proposal(content: str) -> MemoryProposal:
    return MemoryProposal(
        proposal_id=uuid.uuid4(),
        user_id=uuid.UUID(USER_ID),
        proposed_claim={"content": content},
        source_type="user_explicit",
        status="pending",
    )


def _keys(payload: dict[str, Any]) -> list[str]:
    return [section["key"] for section in payload["sections"]]


@pytest.mark.asyncio
async def test_a_briefing_covers_every_source(monkeypatch: pytest.MonkeyPatch) -> None:
    sources = _Sources()
    sources.events = [_event("Standup", 9)]
    sources.messages = [{"subject": "Invoice", "sender": "billing@hetzner.com"}]
    sources.proposals = [_proposal("Alex prefers morning meetings")]
    _install(monkeypatch, sources)
    service = _service(
        claims=[_claim("Contract runs out soon", review_due=True)],
        tasks=[_task("Ship the briefing", due=date(2026, 6, 10))],
    )

    draft = await service.build(user_id=USER_ID, on_date=TODAY)

    assert _keys(draft.payload) == ["calendar", "mail", "proposals", "memory", "tasks"]
    assert "09:00 Standup" in draft.content
    assert "Invoice — billing@hetzner.com" in draft.content
    assert "Alex prefers morning meetings" in draft.content
    assert "Contract runs out soon (review due)" in draft.content
    assert "Ozymandias: Ship the briefing (due 2026-06-10)" in draft.content


@pytest.mark.asyncio
async def test_an_empty_day_says_so(monkeypatch: pytest.MonkeyPatch) -> None:
    _install(monkeypatch, _Sources())

    draft = await _service().build(user_id=USER_ID, on_date=TODAY)

    assert draft.payload["sections"] == []
    assert "Nothing needs your attention today." in draft.content


@pytest.mark.asyncio
async def test_a_missing_google_account_only_costs_its_sections(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A briefing without mail is still worth sending."""
    sources = _Sources()
    sources.calendar_error = RuntimeError("no Google tokens for user")
    sources.mail_error = RuntimeError("no Google tokens for user")
    sources.proposals = [_proposal("Alex moved to Hamburg")]
    _install(monkeypatch, sources)

    draft = await _service().build(user_id=USER_ID, on_date=TODAY)

    assert _keys(draft.payload) == ["proposals"]
    assert "Alex moved to Hamburg" in draft.content


@pytest.mark.asyncio
async def test_claims_expiring_this_week_are_flagged(monkeypatch: pytest.MonkeyPatch) -> None:
    _install(monkeypatch, _Sources())
    soon = datetime.now(tz=UTC) + timedelta(days=3)
    service = _service(
        claims=[
            _claim("Gym membership", valid_to=soon),
            _claim("Passport valid", valid_to=datetime.now(tz=UTC) + timedelta(days=300)),
        ]
    )

    draft = await service.build(user_id=USER_ID, on_date=TODAY)

    memory = draft.payload["sections"][0]
    assert memory["key"] == "memory"
    assert memory["items"] == [f"Gym membership (expires {soon.date().isoformat()})"]


@pytest.mark.asyncio
async def test_a_long_section_is_cut_and_counted(monkeypatch: pytest.MonkeyPatch) -> None:
    """The card is a glance; the exact count still has to be honest."""
    sources = _Sources()
    sources.events = [_event(f"Meeting {index}", 8 + index) for index in range(9)]
    _install(monkeypatch, sources)

    draft = await _service().build(user_id=USER_ID, on_date=TODAY)

    calendar = draft.payload["sections"][0]
    assert len(calendar["items"]) == MAX_ITEMS_PER_SECTION
    assert calendar["total"] == 9
    assert "- and 4 more" in draft.content


@pytest.mark.asyncio
async def test_a_second_run_on_the_same_day_keeps_the_first_briefing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The heartbeat runs hourly; only one briefing a day may be written."""
    _install(monkeypatch, _Sources())
    db = FakeAsyncSession()
    existing = object()
    db.queue_execute_result(FakeQueryResult(single=existing))
    service = BriefingService(cast(AsyncSession, db))

    result = await service.create_for_user(user_id=USER_ID, on_date=TODAY)

    assert result is existing
    assert db.added == []
