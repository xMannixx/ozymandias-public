"""Unit tests for Gmail service."""

from __future__ import annotations

from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.errors import ServiceError
from app.services.gmail_service import GmailService
from tests.conftest import FakeAsyncSession


class _Request:
    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = payload

    def execute(self) -> dict[str, object]:
        return self.payload


class _MessagesApi:
    def __init__(self) -> None:
        self.last_query: str | None = None
        self.last_send_body: dict[str, object] | None = None

    def list(self, *, userId: str, maxResults: int, q: str | None = None) -> _Request:
        assert userId == "me"
        assert maxResults > 0
        self.last_query = q
        return _Request({"messages": [{"id": "msg-1"}]})

    def get(
        self,
        *,
        userId: str,
        id: str,
        format: str,
        metadataHeaders: object | None = None,
    ) -> _Request:
        assert userId == "me"
        if format == "metadata":
            assert metadataHeaders is not None
            return _Request(
                {
                    "id": id,
                    "snippet": "hello snippet",
                    "labelIds": [],
                    "payload": {
                        "headers": [
                            {"name": "From", "value": "sender@example.com"},
                            {"name": "Subject", "value": "Hello"},
                            {"name": "Date", "value": "Tue, 05 Apr 2026 10:00:00 +0000"},
                        ]
                    },
                }
            )
        return _Request(
            {
                "id": id,
                "payload": {
                    "headers": [
                        {"name": "From", "value": "sender@example.com"},
                        {"name": "To", "value": "to@example.com"},
                        {"name": "Subject", "value": "Hello"},
                        {"name": "Date", "value": "Tue, 05 Apr 2026 10:00:00 +0000"},
                    ],
                    "parts": [
                        {"mimeType": "text/plain", "body": {"data": "SGVsbG8="}},
                        {
                            "mimeType": "application/pdf",
                            "filename": "invoice.pdf",
                            "body": {"size": 42},
                        },
                    ],
                },
            }
        )

    def send(self, *, userId: str, body: dict[str, object]) -> _Request:
        assert userId == "me"
        self.last_send_body = body
        return _Request({"id": "sent-1", "threadId": "thread-1"})


class _UsersApi:
    def __init__(self, messages_api: _MessagesApi) -> None:
        self._messages_api = messages_api

    def messages(self) -> _MessagesApi:
        return self._messages_api


class _GmailApi:
    def __init__(self) -> None:
        self.messages_api = _MessagesApi()
        self._users_api = _UsersApi(self.messages_api)

    def users(self) -> _UsersApi:
        return self._users_api


@pytest.mark.asyncio
async def test_list_messages_returns_summaries(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GmailService(cast(AsyncSession, FakeAsyncSession()))
    fake_api = _GmailApi()
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=fake_api))

    result = await service.list_messages(user_id="dev-user")
    assert len(result) == 1
    assert result[0]["id"] == "msg-1"
    assert result[0]["sender"] == "sender@example.com"


@pytest.mark.asyncio
async def test_list_messages_passes_query_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GmailService(cast(AsyncSession, FakeAsyncSession()))
    fake_api = _GmailApi()
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=fake_api))

    await service.list_messages(user_id="dev-user", query="from:boss@example.com")
    assert fake_api.messages_api.last_query == "from:boss@example.com"


@pytest.mark.asyncio
async def test_get_message_returns_detail(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GmailService(cast(AsyncSession, FakeAsyncSession()))
    fake_api = _GmailApi()
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=fake_api))

    result = await service.get_message(user_id="dev-user", message_id="msg-1")
    assert result["id"] == "msg-1"
    assert result["sender"] == "sender@example.com"
    assert result["attachments"] == [{"name": "invoice.pdf", "size": 42}]


@pytest.mark.asyncio
async def test_send_message_returns_ids(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GmailService(cast(AsyncSession, FakeAsyncSession()))
    fake_api = _GmailApi()
    monkeypatch.setattr(service, "_build_service", AsyncMock(return_value=fake_api))

    result = await service.send_message(
        user_id="dev-user",
        to="to@example.com",
        subject="Subject",
        body="Body",
    )
    assert result == {"id": "sent-1", "thread_id": "thread-1"}
    assert fake_api.messages_api.last_send_body is not None


@pytest.mark.asyncio
async def test_list_messages_without_credentials_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GmailService(cast(AsyncSession, FakeAsyncSession()))
    monkeypatch.setattr(
        service,
        "_build_service",
        AsyncMock(side_effect=ServiceError("Google account is not connected")),
    )

    with pytest.raises(ServiceError):
        await service.list_messages(user_id="dev-user")
