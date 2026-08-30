"""Tests for the suggestions on the empty chat screen."""

from __future__ import annotations

import random
import uuid
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.chat_starter_service import (
    GENERIC_STARTERS,
    MAX_STARTERS,
    MAX_TITLE_CHARS,
    ChatStarterService,
)
from tests.conftest import FakeAsyncSession, FakeQueryResult

USER_ID = str(uuid.uuid4())

#: The service queries in a fixed order, so results are queued the same way.
NOTHING_OPEN = [
    FakeQueryResult(values=[]),  # today's briefing
    FakeQueryResult(single=0),  # pending proposals
    FakeQueryResult(single=0),  # tasks due
    FakeQueryResult(single=0),  # memories flagged for review
    FakeQueryResult(values=[]),  # most recent active project
    FakeQueryResult(values=[]),  # most recent conversation
]


def _service(results: list[FakeQueryResult], *, seed: int = 1) -> ChatStarterService:
    db = FakeAsyncSession()
    for result in results:
        db.queue_execute_result(result)
    return ChatStarterService(cast(AsyncSession, db), rng=random.Random(seed))


async def test_an_empty_account_gets_generic_suggestions() -> None:
    starters = await _service(NOTHING_OPEN).suggest(user_id=USER_ID)

    assert len(starters) == MAX_STARTERS
    generic_ids = {starter.id for starter in GENERIC_STARTERS}
    assert {starter.id for starter in starters} <= generic_ids


async def test_open_items_are_suggested_before_generic_ones() -> None:
    results = [
        FakeQueryResult(values=[uuid.uuid4()]),  # a briefing exists for today
        FakeQueryResult(single=3),  # three proposals pending
        FakeQueryResult(single=1),  # one task due
        FakeQueryResult(single=7),  # seven memories flagged
        FakeQueryResult(values=["Pflanzcheck"]),
        FakeQueryResult(values=["Steuer 2026"]),
    ]

    starters = await _service(results).suggest(user_id=USER_ID)

    assert [starter.id for starter in starters[:3]] == ["briefing", "proposals", "tasks"]
    assert "Review 3 proposals" in {starter.title for starter in starters}
    assert "1 task due" in {starter.title for starter in starters}


async def test_one_slot_stays_generic_so_reloading_changes_something() -> None:
    results = [
        FakeQueryResult(values=[uuid.uuid4()]),
        FakeQueryResult(single=2),
        FakeQueryResult(single=2),
        FakeQueryResult(single=2),
        FakeQueryResult(values=["Pflanzcheck"]),
        FakeQueryResult(values=["Steuer 2026"]),
    ]

    starters = await _service(results).suggest(user_id=USER_ID)

    generic_ids = {starter.id for starter in GENERIC_STARTERS}
    assert len([starter for starter in starters if starter.id in generic_ids]) == 1


async def test_repeated_calls_vary_the_generic_suggestions() -> None:
    seen: set[tuple[str, ...]] = set()
    for seed in range(6):
        starters = await _service(NOTHING_OPEN, seed=seed).suggest(user_id=USER_ID)
        seen.add(tuple(starter.id for starter in starters))

    assert len(seen) > 1


async def test_a_suggestion_is_never_repeated_in_one_draw() -> None:
    starters = await _service(NOTHING_OPEN).suggest(user_id=USER_ID)

    ids = [starter.id for starter in starters]
    assert len(ids) == len(set(ids))


async def test_singular_wording_for_a_single_item() -> None:
    results = [
        FakeQueryResult(values=[]),
        FakeQueryResult(single=1),
        FakeQueryResult(single=0),
        FakeQueryResult(single=1),
        FakeQueryResult(values=[]),
        FakeQueryResult(values=[]),
    ]

    starters = await _service(results).suggest(user_id=USER_ID)

    titles = {starter.title for starter in starters}
    assert "Review 1 proposal" in titles
    assert "Check 1 memory" in titles


async def test_a_long_project_name_is_shortened_to_fit_the_button() -> None:
    long_name = "Rebuild the entire greenhouse monitoring stack from scratch"
    results = [
        FakeQueryResult(values=[]),
        FakeQueryResult(single=0),
        FakeQueryResult(single=0),
        FakeQueryResult(single=0),
        FakeQueryResult(values=[long_name]),
        FakeQueryResult(values=[]),
    ]

    starters = await _service(results).suggest(user_id=USER_ID)
    project = next(starter for starter in starters if starter.id == "project")

    assert len(project.title) <= MAX_TITLE_CHARS
    # The prompt keeps the full name; only the button label is cut.
    assert long_name in project.prompt


async def test_every_starter_carries_a_prompt_and_an_icon() -> None:
    starters = await _service(NOTHING_OPEN).suggest(user_id=USER_ID)

    for starter in starters:
        assert starter.prompt.strip()
        assert starter.icon.strip()
        assert starter.title.strip()
