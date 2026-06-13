"""API tests for audit feed endpoint."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import get_current_user
from app.models.audit import AuditLog
from app.services.audit_service import AuditService


def _audit_entry(*, event_type: str = "turn_processed", sensitivity: str = "S1") -> AuditLog:
    return AuditLog(
        audit_id=uuid.uuid4(),
        event_type=event_type,
        user_id=uuid.uuid4(),
        channel="web",
        payload={"provider": "deepseek"},
        source_ref="turn-1",
        result="success",
        sensitivity=sensitivity,
        created_at=datetime.now(tz=UTC),
    )


@pytest.mark.asyncio
async def test_get_audit_returns_paginated_entries(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list_entries(self: AuditService, **kwargs: object) -> tuple[list[AuditLog], int]:
        del self, kwargs
        return [_audit_entry()], 1

    monkeypatch.setattr(AuditService, "list_entries", fake_list_entries)
    response = await client.get("/audit")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert len(body["entries"]) == 1


@pytest.mark.asyncio
async def test_get_audit_event_type_filter(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list_entries(self: AuditService, **kwargs: object) -> tuple[list[AuditLog], int]:
        del self
        assert kwargs["event_type"] == "memory_confirmed"
        return [_audit_entry(event_type="memory_confirmed")], 1

    monkeypatch.setattr(AuditService, "list_entries", fake_list_entries)
    response = await client.get("/audit?event_type=memory_confirmed")
    assert response.status_code == 200
    assert response.json()["entries"][0]["event_type"] == "memory_confirmed"


@pytest.mark.asyncio
async def test_get_audit_sensitivity_filter(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list_entries(self: AuditService, **kwargs: object) -> tuple[list[AuditLog], int]:
        del self
        assert kwargs["sensitivity"] == "S3"
        return [_audit_entry(sensitivity="S3")], 1

    monkeypatch.setattr(AuditService, "list_entries", fake_list_entries)
    response = await client.get("/audit?sensitivity=S3")
    assert response.status_code == 200
    assert response.json()["entries"][0]["sensitivity"] == "S3"


@pytest.mark.asyncio
async def test_get_audit_after_filter(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_list_entries(self: AuditService, **kwargs: object) -> tuple[list[AuditLog], int]:
        del self
        assert kwargs["after"] is not None
        return [_audit_entry()], 1

    monkeypatch.setattr(AuditService, "list_entries", fake_list_entries)
    response = await client.get("/audit?after=2026-01-01T00:00:00Z")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_audit_pagination_params(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list_entries(self: AuditService, **kwargs: object) -> tuple[list[AuditLog], int]:
        del self
        assert kwargs["limit"] == 5
        assert kwargs["offset"] == 0
        return [_audit_entry()], 11

    monkeypatch.setattr(AuditService, "list_entries", fake_list_entries)
    response = await client.get("/audit?limit=5&offset=0")
    assert response.status_code == 200
    assert response.json()["total"] == 11


@pytest.mark.asyncio
async def test_get_audit_excludes_s4_by_default(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list_entries(self: AuditService, **kwargs: object) -> tuple[list[AuditLog], int]:
        del self
        assert kwargs["exclude_s4"] is True
        return [], 0

    monkeypatch.setattr(AuditService, "list_entries", fake_list_entries)
    response = await client.get("/audit")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_get_audit_includes_s4_when_explicit_filter(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_list_entries(self: AuditService, **kwargs: object) -> tuple[list[AuditLog], int]:
        del self
        assert kwargs["sensitivity"] == "S4"
        assert kwargs["exclude_s4"] is False
        return [_audit_entry(sensitivity="S4")], 1

    monkeypatch.setattr(AuditService, "list_entries", fake_list_entries)
    response = await client.get("/audit?sensitivity=S4")
    assert response.status_code == 200
    assert response.json()["entries"][0]["sensitivity"] == "S4"


@pytest.mark.asyncio
async def test_get_audit_without_auth_returns_401(app: FastAPI) -> None:
    app.dependency_overrides.pop(get_current_user, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/audit")
    assert response.status_code == 401
