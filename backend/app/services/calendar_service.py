"""Google Calendar API service wrapper."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.google_oauth import GoogleOAuthService
from app.services.errors import ServiceError

try:
    from googleapiclient.discovery import build as google_build
except ImportError:  # pragma: no cover - exercised only when deps are missing
    google_build = None


class CalendarService:
    """Read and write calendar events for one authenticated user."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.oauth = GoogleOAuthService()

    async def list_events(
        self,
        *,
        user_id: str,
        time_min: datetime | None = None,
        time_max: datetime | None = None,
        max_results: int = 50,
    ) -> list[dict[str, Any]]:
        """Return calendar events from the primary calendar."""
        service = await self._build_service(user_id=user_id)
        payload = await asyncio.to_thread(
            lambda: (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=self._format_datetime(time_min),
                    timeMax=self._format_datetime(time_max),
                    maxResults=max_results,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
        )
        items = payload.get("items", []) if isinstance(payload, dict) else []
        return [self._map_event(item) for item in items if isinstance(item, dict)]

    async def get_event(self, *, user_id: str, event_id: str) -> dict[str, Any]:
        """Return one calendar event."""
        service = await self._build_service(user_id=user_id)
        payload = await asyncio.to_thread(
            lambda: service.events().get(calendarId="primary", eventId=event_id).execute()
        )
        if not isinstance(payload, dict):
            raise ServiceError("Invalid calendar event response")
        return self._map_event(payload)

    async def create_event(
        self,
        *,
        user_id: str,
        summary: str,
        start: datetime,
        end: datetime,
        description: str | None = None,
        location: str | None = None,
    ) -> dict[str, Any]:
        """Create one calendar event on the primary calendar."""
        service = await self._build_service(user_id=user_id)
        body: dict[str, Any] = {
            "summary": summary,
            "start": {"dateTime": self._format_datetime(start)},
            "end": {"dateTime": self._format_datetime(end)},
        }
        if description:
            body["description"] = description
        if location:
            body["location"] = location
        payload = await asyncio.to_thread(
            lambda: (
                service.events()
                .insert(calendarId="primary", body=body, sendUpdates="none")
                .execute()
            )
        )
        if not isinstance(payload, dict):
            raise ServiceError("Invalid calendar create response")
        return self._map_event(payload)

    async def delete_event(self, *, user_id: str, event_id: str) -> None:
        """Delete one calendar event."""
        service = await self._build_service(user_id=user_id)
        await asyncio.to_thread(
            lambda: service.events().delete(calendarId="primary", eventId=event_id).execute()
        )

    async def _build_service(self, *, user_id: str) -> Any:
        if google_build is None:
            raise ServiceError(
                "Google API client dependency is missing; install google-api-python-client"
            )
        credentials = await self.oauth.get_valid_credentials(user_id=user_id, db=self.db)
        return await asyncio.to_thread(
            lambda: google_build("calendar", "v3", credentials=credentials, cache_discovery=False)
        )

    def _map_event(self, event: dict[str, Any]) -> dict[str, Any]:
        attendees_raw = event.get("attendees", [])
        attendees: list[str] = []
        if isinstance(attendees_raw, list):
            for item in attendees_raw:
                if isinstance(item, dict):
                    email = item.get("email")
                    if isinstance(email, str) and email:
                        attendees.append(email)
        return {
            "id": str(event.get("id", "")),
            "summary": str(event.get("summary", "")),
            "start": self._parse_datetime(event.get("start")),
            "end": self._parse_datetime(event.get("end")),
            "location": event.get("location") if isinstance(event.get("location"), str) else None,
            "description": (
                event.get("description") if isinstance(event.get("description"), str) else None
            ),
            "attendees": attendees,
            "html_link": event.get("htmlLink") if isinstance(event.get("htmlLink"), str) else None,
        }

    def _format_datetime(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.isoformat()

    def _parse_datetime(self, value: Any) -> datetime:
        if not isinstance(value, dict):
            return datetime.now(tz=UTC)
        date_time = value.get("dateTime")
        if isinstance(date_time, str):
            return self._parse_datetime_string(date_time)
        date_only = value.get("date")
        if isinstance(date_only, str):
            return self._parse_datetime_string(f"{date_only}T00:00:00+00:00")
        return datetime.now(tz=UTC)

    def _parse_datetime_string(self, value: str) -> datetime:
        normalized = value.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError:
            return datetime.now(tz=UTC)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed
