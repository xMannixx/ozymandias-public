"""Unit tests for Calendar service."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.calendar_service import CalendarService
from app.services.errors import ServiceError
from tests.conftest import FakeAsyncSession


class _Request:
    def __init__(self, payload: dict[str, object] | None = None) -> None:
        self.payload = payload if payload is not None else {}

    def execute(self) -> dict[str, object]:
        return self.payload


class _EventsApi:
    def __init__(self) -> None:
        self.deleted_event_id: str | None = None

    def list(self, **_: object) -> _Request:
        return _Request(
            {
                "items": [
                    {
                        "id": "evt-1",
                        "summary": "Meeting",
                        "start": {"dateTime": "2026-04-05T10:00:00Z"},
                        "end": {"dateTime": "2026-04-05T11:00:00Z"},
                        "attendees": [{"email": "a@example.com"}],
                        "htmlLink": "https://calendar.google.com/event?eid=1",
                    }
                ]
            }
        )

    def get(self, **_: object) -> _Request:
        return _Request(
            {
                "id": "evt-1",
                "summary": "Meeting",
                "start": {"dateTime": "2026-04-05T10:00:00Z"},
                "end": {"dateTime": "2026-04-05T11:00:00Z"},
                "attendees": [],
            }
        )

    def insert(self, **_: object) -> _Request:
        return _Request(
            {
                "id": "evt-2",
                "summary": "Created",
                "start": {"dateTime": "2026-04-05T12:00:00Z"},
                "end": {"dateTime": "2026-04-05T13:00:00Z"},
                "attendees": [],
                "htmlLink": "https://calendar.google.com/event?eid=2",
            }
        )

    def delete(self, *, calendarId: str, eventId: str) -> _Request:
        assert calendarId == "primary"
        self.deleted_event_id = eventId
        return _Request()


class _CalendarApi:
    def __init__(self) -> None:
        self.events_api = _EventsApi()

    def events(self) -> _EventsApi:
        return self.events_api


@pytest.mark.asyncio
async def test_list_events_returns_events(monkeypatch: pytest.MonkeyPatch) -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    fake_api = _CalendarApi()
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=fake_api))

    result = await service.list_events(user_id="dev-user")
    assert len(result) == 1
    assert result[0]["id"] == "evt-1"
    assert result[0]["summary"] == "Meeting"


@pytest.mark.asyncio
async def test_create_event_returns_created_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    fake_api = _CalendarApi()
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=fake_api))

    result = await service.create_event(
        user_id="dev-user",
        summary="Created",
        start=datetime(2026, 4, 5, 12, 0, tzinfo=UTC),
        end=datetime(2026, 4, 5, 13, 0, tzinfo=UTC),
    )
    assert result["id"] == "evt-2"
    assert result["summary"] == "Created"


@pytest.mark.asyncio
async def test_delete_event_calls_calendar_delete(monkeypatch: pytest.MonkeyPatch) -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    fake_api = _CalendarApi()
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=fake_api))

    await service.delete_event(user_id="dev-user", event_id="evt-1")
    assert fake_api.events_api.deleted_event_id == "evt-1"


@pytest.mark.asyncio
async def test_get_event_returns_mapped_event(monkeypatch: pytest.MonkeyPatch) -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    fake_api = _CalendarApi()
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=fake_api))

    result = await service.get_event(user_id="dev-user", event_id="evt-1")
    assert result["id"] == "evt-1"
    assert result["summary"] == "Meeting"


@pytest.mark.asyncio
async def test_create_event_with_description_and_location(monkeypatch: pytest.MonkeyPatch) -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    fake_api = _CalendarApi()
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=fake_api))

    result = await service.create_event(
        user_id="dev-user",
        summary="Created",
        start=datetime(2026, 4, 5, 12, 0, tzinfo=UTC),
        end=datetime(2026, 4, 5, 13, 0, tzinfo=UTC),
        description="A description",
        location="Berlin",
    )
    assert result["id"] == "evt-2"


@pytest.mark.asyncio
async def test_create_event_raises_on_invalid_response(monkeypatch: pytest.MonkeyPatch) -> None:
    """When the API returns a non-dict, ServiceError is raised."""

    class _BadRequest:
        def execute(self) -> str:
            return "not-a-dict"

    class _BadEventsApi:
        def insert(self, **_: object) -> _BadRequest:
            return _BadRequest()

    class _BadCalendarApi:
        def events(self) -> _BadEventsApi:
            return _BadEventsApi()

    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=_BadCalendarApi()))

    with pytest.raises(ServiceError):
        await service.create_event(
            user_id="dev-user",
            summary="Bad",
            start=datetime(2026, 4, 5, 12, 0, tzinfo=UTC),
            end=datetime(2026, 4, 5, 13, 0, tzinfo=UTC),
        )


def test_format_datetime_returns_none_for_none() -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    assert service._format_datetime(None) is None


def test_format_datetime_adds_utc_to_naive() -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    naive = datetime(2026, 1, 1, 12, 0)
    result = service._format_datetime(naive)
    assert result is not None
    assert "+00:00" in result


def test_parse_datetime_with_date_only_value() -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    result = service._parse_datetime({"date": "2026-04-05"})
    assert result.year == 2026
    assert result.month == 4
    assert result.day == 5


def test_parse_datetime_fallback_on_missing_keys() -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    result = service._parse_datetime({})
    assert isinstance(result, datetime)


def test_parse_datetime_fallback_on_non_dict() -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    result = service._parse_datetime("not-a-dict")
    assert isinstance(result, datetime)


def test_parse_datetime_string_handles_invalid_value() -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    result = service._parse_datetime_string("not-a-date")
    assert isinstance(result, datetime)


def test_parse_datetime_string_naive_gets_utc() -> None:
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    result = service._parse_datetime_string("2026-04-05T12:00:00")
    assert result.tzinfo is not None


@pytest.mark.asyncio
async def test_get_event_raises_on_invalid_response(monkeypatch: pytest.MonkeyPatch) -> None:
    """When calendar API returns a non-dict for get, ServiceError is raised."""

    class _NonDictRequest:
        def execute(self) -> str:
            return "not-a-dict"

    class _BadGetEventsApi:
        def get(self, **_: object) -> _NonDictRequest:
            return _NonDictRequest()

    class _BadGetCalendarApi:
        def events(self) -> _BadGetEventsApi:
            return _BadGetEventsApi()

    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=_BadGetCalendarApi()))

    with pytest.raises(ServiceError):
        await service.get_event(user_id="dev-user", event_id="evt-1")


@pytest.mark.asyncio
async def test_build_service_raises_when_google_build_none(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When google_build is None (missing dep), _build_service raises ServiceError."""
    import app.services.calendar_service as cs_module

    monkeypatch.setattr(cs_module, "google_build", None)
    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))

    with pytest.raises(ServiceError, match="missing"):
        await service._build_service(user_id="dev-user")


@pytest.mark.asyncio
async def test_build_service_returns_api_object(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When google_build and credentials are available, _build_service returns the API."""
    import app.services.calendar_service as cs_module

    fake_credentials = object()
    fake_service = _CalendarApi()

    monkeypatch.setattr(cs_module, "google_build", lambda *a, **kw: fake_service)

    service = CalendarService(cast(AsyncSession, FakeAsyncSession()))
    monkeypatch.setattr(
        service.oauth,
        "get_valid_credentials",
        AsyncMock(return_value=fake_credentials),
    )
    result = await service._build_service(user_id="dev-user")
    assert result is fake_service
