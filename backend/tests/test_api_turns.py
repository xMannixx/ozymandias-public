"""API tests for turn endpoints."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import get_current_user
from app.schemas import Sensitivity, TaintSummary, TrustLevel
from app.schemas.api_models import ClaimProcessResult, TurnResult
from app.services.errors import LiveWebPermissionRequiredError, LocalProviderUnavailableError
from app.services.turn_service import TurnService


@pytest.mark.asyncio
async def test_process_turn_returns_result(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_process_turn(self: TurnService, *, user_id: str, payload: object) -> TurnResult:
        assert user_id == "test-user-id"
        assert payload is not None
        return TurnResult(
            turn_id="turn-123",
            provider="deepseek",
            model="deepseek-chat",
            claims_processed=1,
            filtered_count=0,
            results=[ClaimProcessResult(claim_ref="user:42:city:Berlin", status="created")],
            taint_summary=TaintSummary(
                effective_trust=TrustLevel.T3,
                effective_sensitivity=Sensitivity.S1,
                is_tainted=False,
                taint_sources=[],
            ),
        )

    monkeypatch.setattr(TurnService, "process_turn", fake_process_turn)
    response = await client.post("/turns", json={"text": "Hello", "claims": []})
    assert response.status_code == 200
    assert response.json()["turn_id"] == "turn-123"


@pytest.mark.asyncio
async def test_process_turn_requires_auth(app: FastAPI) -> None:
    app.dependency_overrides.pop(get_current_user, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/turns", json={"text": "Hello", "claims": []})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_process_turn_returns_structured_local_provider_error(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_process_turn(self: TurnService, *, user_id: str, payload: object) -> TurnResult:
        del self, user_id, payload
        raise LocalProviderUnavailableError(
            provider="ollama",
            sensitivity="S3",
            fallback_allowed=True,
            detail="connection refused",
        )

    monkeypatch.setattr(TurnService, "process_turn", fake_process_turn)
    response = await client.post("/turns", json={"text": "Hello"})
    assert response.status_code == 503
    assert response.json()["detail"] == {
        "code": "local_provider_unavailable",
        "message": "connection refused",
        "provider": "ollama",
        "sensitivity": "S3",
        "fallback_allowed": True,
    }


@pytest.mark.asyncio
async def test_process_turn_returns_live_web_confirmation_required(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_process_turn(self: TurnService, *, user_id: str, payload: object) -> TurnResult:
        del self, user_id, payload
        raise LiveWebPermissionRequiredError(
            sensitivity="S3",
            detail="S3 bestaetigen",
        )

    monkeypatch.setattr(TurnService, "process_turn", fake_process_turn)
    response = await client.post("/turns", json={"text": "Hello"})
    assert response.status_code == 409
    assert response.json()["detail"] == {
        "code": "live_web_confirmation_required",
        "message": "S3 bestaetigen",
        "sensitivity": "S3",
    }


@pytest.mark.asyncio
async def test_process_turn_stream_returns_sse_events(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_process_turn_stream(
        self: TurnService, *, user_id: str, payload: object
    ) -> object:
        del self, payload
        assert user_id == "test-user-id"
        yield {"event": "delta", "data": {"text": "Hel"}}
        yield {"event": "delta", "data": {"text": "lo"}}
        yield {"event": "result", "data": {"turn_id": "turn-123", "response_text": "Hello"}}

    monkeypatch.setattr(TurnService, "process_turn_stream", fake_process_turn_stream)
    response = await client.post("/turns/stream", json={"text": "Hello"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    body = response.text
    assert 'event: delta\ndata: {"text": "Hel"}\n\n' in body
    assert 'event: delta\ndata: {"text": "lo"}\n\n' in body
    assert "event: result\n" in body
    assert '"turn_id": "turn-123"' in body


@pytest.mark.asyncio
async def test_process_turn_stream_emits_error_event(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_process_turn_stream(
        self: TurnService, *, user_id: str, payload: object
    ) -> object:
        del self, user_id, payload
        yield {"event": "error", "data": {"code": "service_error", "message": "boom"}}

    monkeypatch.setattr(TurnService, "process_turn_stream", fake_process_turn_stream)
    response = await client.post("/turns/stream", json={"text": "Hello"})
    assert response.status_code == 200
    assert "event: error\n" in response.text
    assert '"code": "service_error"' in response.text
