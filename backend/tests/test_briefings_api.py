"""API tests for the briefing endpoint."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

import pytest
from httpx import AsyncClient

from app.models.briefing import Briefing
from app.services.briefing_service import BriefingService


def _briefing() -> Briefing:
    return Briefing(
        briefing_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        briefing_date=date(2026, 6, 15),
        content="Briefing for Monday, 15 June 2026\n\nToday's calendar (1)\n- 09:00 Standup\n",
        payload={
            "date": "2026-06-15",
            "sections": [
                {
                    "key": "calendar",
                    "title": "Today's calendar",
                    "items": ["09:00 Standup"],
                    "total": 1,
                }
            ],
        },
        created_at=datetime(2026, 6, 15, 7, 5, tzinfo=UTC),
    )


@pytest.mark.asyncio
async def test_latest_briefing_is_returned_with_its_sections(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _latest(self: BriefingService, *, user_id: str) -> Briefing:
        del self
        assert user_id == "test-user-id"
        return _briefing()

    monkeypatch.setattr(BriefingService, "latest", _latest)

    response = await client.get("/briefings/latest")

    assert response.status_code == 200
    body = response.json()
    assert body["briefing_date"] == "2026-06-15"
    assert body["sections"] == [
        {"key": "calendar", "title": "Today's calendar", "items": ["09:00 Standup"], "total": 1}
    ]


@pytest.mark.asyncio
async def test_no_briefing_yet_is_null_rather_than_an_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A fresh install has no briefing, and the dashboard must not show an error."""

    async def _latest(self: BriefingService, *, user_id: str) -> Briefing | None:
        del self, user_id
        return None

    monkeypatch.setattr(BriefingService, "latest", _latest)

    response = await client.get("/briefings/latest")

    assert response.status_code == 200
    assert response.json() is None


@pytest.mark.asyncio
async def test_a_briefing_without_a_usable_payload_still_renders(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _latest(self: BriefingService, *, user_id: str) -> Briefing:
        del self, user_id
        briefing = _briefing()
        briefing.payload = {}
        return briefing

    monkeypatch.setattr(BriefingService, "latest", _latest)

    response = await client.get("/briefings/latest")

    assert response.status_code == 200
    assert response.json()["sections"] == []
    assert "Standup" in response.json()["content"]
