"""Gmail API service wrapper."""

from __future__ import annotations

import asyncio
import base64
from datetime import UTC, datetime
from email.message import EmailMessage
from email.utils import parsedate_to_datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.google_oauth import GoogleOAuthService
from app.services.errors import ServiceError

try:
    from googleapiclient.discovery import build as google_build
except ImportError:  # pragma: no cover - exercised only when deps are missing
    google_build = None


class GmailService:
    """Read and send Gmail messages for one authenticated user."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.oauth = GoogleOAuthService()

    async def list_messages(
        self,
        *,
        user_id: str,
        max_results: int = 20,
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        """Return Gmail inbox summaries."""
        service = await self._build_service(user_id=user_id)
        list_payload = await asyncio.to_thread(
            lambda: (
                service.users()
                .messages()
                .list(userId="me", maxResults=max_results, q=query)
                .execute()
            )
        )
        messages = list_payload.get("messages", []) if isinstance(list_payload, dict) else []
        summaries: list[dict[str, Any]] = []
        for item in messages:
            message_id = item.get("id")
            if not isinstance(message_id, str):
                continue

            def _fetch_metadata(message_id: str = message_id) -> Any:
                return (
                    service.users()
                    .messages()
                    .get(
                        userId="me",
                        id=message_id,
                        format="metadata",
                        metadataHeaders=["From", "Subject", "Date"],
                    )
                    .execute()
                )

            payload = await asyncio.to_thread(_fetch_metadata)
            summaries.append(self._to_summary(payload))
        return summaries

    async def get_message(self, *, user_id: str, message_id: str) -> dict[str, Any]:
        """Return one full Gmail message."""
        service = await self._build_service(user_id=user_id)
        payload = await asyncio.to_thread(
            lambda: (
                service.users().messages().get(userId="me", id=message_id, format="full").execute()
            )
        )
        data = payload if isinstance(payload, dict) else {}
        message_payload = data.get("payload", {})
        headers = self._headers(message_payload)
        to_header = headers.get("to", "")
        to_values = [item.strip() for item in to_header.split(",") if item.strip()]
        return {
            "id": str(data.get("id", message_id)),
            "sender": headers.get("from", ""),
            "to": to_values,
            "subject": headers.get("subject"),
            "date": self._parse_date(headers.get("date")),
            "body": self._extract_body(message_payload),
            "attachments": self._extract_attachments(message_payload),
        }

    async def send_message(
        self,
        *,
        user_id: str,
        to: str,
        subject: str,
        body: str,
    ) -> dict[str, str]:
        """Send one Gmail message and return message/thread IDs."""
        service = await self._build_service(user_id=user_id)
        message = EmailMessage()
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)
        raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        payload = await asyncio.to_thread(
            lambda: (
                service.users().messages().send(userId="me", body={"raw": raw_message}).execute()
            )
        )
        if not isinstance(payload, dict):
            raise ServiceError("Invalid Gmail send response")
        message_id = payload.get("id")
        thread_id = payload.get("threadId")
        if not isinstance(message_id, str) or not isinstance(thread_id, str):
            raise ServiceError("Gmail send response is missing identifiers")
        return {"id": message_id, "thread_id": thread_id}

    async def _build_service(self, *, user_id: str) -> Any:
        if google_build is None:
            raise ServiceError(
                "Google API client dependency is missing; install google-api-python-client"
            )
        credentials = await self.oauth.get_valid_credentials(user_id=user_id, db=self.db)
        return await asyncio.to_thread(
            lambda: google_build("gmail", "v1", credentials=credentials, cache_discovery=False)
        )

    def _headers(self, payload: Any) -> dict[str, str]:
        headers: dict[str, str] = {}
        for item in payload.get("headers", []) if isinstance(payload, dict) else []:
            name = item.get("name")
            value = item.get("value")
            if isinstance(name, str) and isinstance(value, str):
                headers[name.lower()] = value
        return headers

    def _to_summary(self, payload: Any) -> dict[str, Any]:
        data = payload if isinstance(payload, dict) else {}
        message_payload = data.get("payload", {})
        headers = self._headers(message_payload)
        label_ids = data.get("labelIds", [])
        is_read = not (isinstance(label_ids, list) and "UNREAD" in label_ids)
        return {
            "id": str(data.get("id", "")),
            "subject": headers.get("subject"),
            "sender": headers.get("from", ""),
            "snippet": str(data.get("snippet", "")),
            "date": self._parse_date(headers.get("date")),
            "is_read": is_read,
        }

    def _parse_date(self, value: str | None) -> datetime:
        if not value:
            return datetime.now(tz=UTC)
        try:
            parsed = parsedate_to_datetime(value)
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=UTC)
            return parsed
        except TypeError:
            return datetime.now(tz=UTC)
        except ValueError:
            return datetime.now(tz=UTC)

    def _extract_body(self, payload: Any) -> str:
        text_part = self._find_part(payload, mime_type="text/plain")
        if text_part:
            decoded = self._decode_part_data(text_part)
            if decoded:
                return decoded
        html_part = self._find_part(payload, mime_type="text/html")
        if html_part:
            decoded = self._decode_part_data(html_part)
            if decoded:
                return decoded
        if isinstance(payload, dict):
            body = payload.get("body", {})
            return self._decode_part_data(body)
        return ""

    def _extract_attachments(self, payload: Any) -> list[dict[str, str | int]]:
        attachments: list[dict[str, str | int]] = []
        for part in self._iter_parts(payload):
            filename = part.get("filename")
            if not isinstance(filename, str) or not filename:
                continue
            body = part.get("body", {})
            size = body.get("size", 0) if isinstance(body, dict) else 0
            attachments.append({"name": filename, "size": int(size or 0)})
        return attachments

    def _decode_part_data(self, part: Any) -> str:
        if not isinstance(part, dict):
            return ""
        data = part.get("data")
        if not isinstance(data, str) or not data:
            return ""
        padding = "=" * (-len(data) % 4)
        try:
            raw = base64.urlsafe_b64decode(data + padding)
        except ValueError:
            return ""
        except TypeError:
            return ""
        return raw.decode("utf-8", errors="replace")

    def _find_part(self, payload: Any, *, mime_type: str) -> dict[str, Any] | None:
        for part in self._iter_parts(payload):
            part_type = part.get("mimeType")
            if isinstance(part_type, str) and part_type.lower() == mime_type.lower():
                body = part.get("body", {})
                if isinstance(body, dict):
                    return body
                return None
        return None

    def _iter_parts(self, payload: Any) -> list[dict[str, Any]]:
        if not isinstance(payload, dict):
            return []
        parts = payload.get("parts", [])
        if not isinstance(parts, list):
            return []
        collected: list[dict[str, Any]] = []
        stack = [item for item in parts if isinstance(item, dict)]
        while stack:
            current = stack.pop()
            collected.append(current)
            nested = current.get("parts", [])
            if isinstance(nested, list):
                stack.extend(item for item in nested if isinstance(item, dict))
        return collected
