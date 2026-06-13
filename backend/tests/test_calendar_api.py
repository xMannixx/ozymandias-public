"""API tests for calendar endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.services.audit_service import AuditService
from app.services.calendar_service import CalendarService


def _event_payload(event_id: str) -> dict[str, object]:
    return {
        "id": event_id,
        "summary": "Meeting",
        "start": datetime(2026, 4, 5, 10, 0, tzinfo=UTC),
        "end": datetime(2026, 4, 5, 11, 0, tzinfo=UTC),
        "location": None,
        "description": None,
        "attendees": [],
        "html_link": "https://calendar.google.com/event?eid=1",
    }


@pytest.mark.asyncio
async def test_get_calendar_returns_200(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        CalendarService,
        "list_events",
        AsyncMock(return_value=[_event_payload("evt-1")]),
    )
    response = await client.get("/calendar")
    assert response.status_code == 200
    assert response.json()[0]["id"] == "evt-1"


@pytest.mark.asyncio
async def test_post_calendar_returns_200_and_writes_audit(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        CalendarService,
        "create_event",
        AsyncMock(return_value=_event_payload("evt-2")),
    )
    audit_log = AsyncMock()
    monkeypatch.setattr(AuditService, "log", audit_log)

    response = await client.post(
        "/calendar",
        json={
            "summary": "Meeting",
            "start": "2026-04-05T10:00:00Z",
            "end": "2026-04-05T11:00:00Z",
        },
    )
    assert response.status_code == 200
    assert response.json()["id"] == "evt-2"
    assert audit_log.await_count == 1


@pytest.mark.asyncio
async def test_delete_calendar_returns_200(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(CalendarService, "delete_event", AsyncMock(return_value=None))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.delete("/calendar/evt-1")
    assert response.status_code == 200
    assert response.json() == {"deleted": True}


@pytest.mark.asyncio
async def test_get_calendar_event_returns_200(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        CalendarService,
        "get_event",
        AsyncMock(return_value=_event_payload("evt-1")),
    )
    response = await client.get("/calendar/evt-1")
    assert response.status_code == 200
    assert response.json()["id"] == "evt-1"


@pytest.mark.asyncio
async def test_get_calendar_event_returns_400_on_service_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services.errors import ServiceError

    monkeypatch.setattr(
        CalendarService,
        "get_event",
        AsyncMock(side_effect=ServiceError("not found")),
    )
    response = await client.get("/calendar/evt-1")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_calendar_returns_400_on_service_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services.errors import ServiceError

    monkeypatch.setattr(
        CalendarService,
        "list_events",
        AsyncMock(side_effect=ServiceError("calendar unavailable")),
    )
    response = await client.get("/calendar")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_post_calendar_returns_400_on_service_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services.errors import ServiceError

    monkeypatch.setattr(
        CalendarService,
        "create_event",
        AsyncMock(side_effect=ServiceError("calendar unavailable")),
    )
    response = await client.post(
        "/calendar",
        json={
            "summary": "Meeting",
            "start": "2026-04-05T10:00:00Z",
            "end": "2026-04-05T11:00:00Z",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_delete_calendar_returns_400_on_service_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services.errors import ServiceError

    monkeypatch.setattr(
        CalendarService,
        "delete_event",
        AsyncMock(side_effect=ServiceError("calendar unavailable")),
    )
    response = await client.delete("/calendar/evt-1")
    assert response.status_code == 400
