"""API tests for Gmail-backed mail endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import get_current_user
from app.services.audit_service import AuditService
from app.services.gmail_service import GmailService


@pytest.mark.asyncio
async def test_get_mail_list_returns_200(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        GmailService,
        "list_messages",
        AsyncMock(
            return_value=[
                {
                    "id": "msg-1",
                    "subject": "Hello",
                    "sender": "sender@example.com",
                    "snippet": "snippet",
                    "date": datetime.now(tz=UTC),
                    "is_read": True,
                }
            ]
        ),
    )
    response = await client.get("/mail")
    assert response.status_code == 200
    assert response.json()[0]["id"] == "msg-1"


@pytest.mark.asyncio
async def test_get_mail_detail_returns_200(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        GmailService,
        "get_message",
        AsyncMock(
            return_value={
                "id": "msg-1",
                "sender": "sender@example.com",
                "to": ["to@example.com"],
                "subject": "Hello",
                "date": datetime.now(tz=UTC),
                "body": "Body",
                "attachments": [],
            }
        ),
    )
    response = await client.get("/mail/msg-1")
    assert response.status_code == 200
    assert response.json()["id"] == "msg-1"


@pytest.mark.asyncio
async def test_post_mail_send_returns_200_and_writes_audit(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        GmailService,
        "send_message",
        AsyncMock(return_value={"id": "msg-sent", "thread_id": "thread-1"}),
    )
    audit_log = AsyncMock()
    monkeypatch.setattr(AuditService, "log", audit_log)

    response = await client.post(
        "/mail/send",
        json={"to": "to@example.com", "subject": "Hi", "body": "Body"},
    )
    assert response.status_code == 200
    assert response.json()["id"] == "msg-sent"
    assert audit_log.await_count == 1


@pytest.mark.asyncio
async def test_get_mail_without_auth_returns_401(app: FastAPI) -> None:
    app.dependency_overrides.pop(get_current_user, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/mail")
    assert response.status_code == 401
