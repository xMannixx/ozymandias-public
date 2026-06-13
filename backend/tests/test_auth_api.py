"""API tests for Google OAuth endpoints."""

from __future__ import annotations

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import fakeredis.aioredis
import pytest
from httpx import ASGITransport, AsyncClient

from app.auth.google_oauth import GoogleOAuthForbiddenError, GoogleOAuthService
from app.auth.jwt import get_current_user
from app.database import get_db, get_redis
from app.main import create_app
from app.services.errors import ServiceError
from tests.conftest import fake_get_current_user, fake_get_db


@pytest.mark.asyncio
async def test_get_google_auth_url_returns_url(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        GoogleOAuthService,
        "get_auth_url",
        lambda self, state: f"https://accounts.google.com/o/oauth2/v2/auth?state={state}",
    )
    response = await client.get("/auth/google/url")
    assert response.status_code == 200
    assert "accounts.google.com" in response.json()["url"]


@pytest.mark.asyncio
async def test_get_google_status_returns_false_without_tokens(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        GoogleOAuthService,
        "status",
        AsyncMock(return_value={"connected": False, "email": None, "scopes": []}),
    )
    response = await client.get("/auth/google/status")
    assert response.status_code == 200
    assert response.json() == {"connected": False, "email": None, "scopes": []}


@pytest.mark.asyncio
async def test_post_google_disconnect_deletes_tokens(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    disconnect_mock = AsyncMock(return_value=True)
    monkeypatch.setattr(GoogleOAuthService, "disconnect", disconnect_mock)
    response = await client.post("/auth/google/disconnect")
    assert response.status_code == 200
    assert response.json() == {"disconnected": True}
    assert disconnect_mock.await_count == 1


@pytest.mark.asyncio
async def test_get_google_callback_without_state_returns_400(client: AsyncClient) -> None:
    response = await client.get("/auth/google/callback", params={"code": "abc"})
    assert response.status_code == 400
    assert "state" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_google_callback_without_code_returns_400(client: AsyncClient) -> None:
    response = await client.get("/auth/google/callback", params={"state": "some-state"})
    assert response.status_code == 400
    assert "code" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_google_callback_expired_state_returns_400(client: AsyncClient) -> None:
    """When the OAuth state is not found in redis, return 400."""
    # fakeredis starts empty, so the state key lookup will return None
    response = await client.get(
        "/auth/google/callback", params={"code": "valid-code", "state": "expired-state"}
    )
    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_google_callback_success_redirects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When state is valid in redis, callback exchanges code and redirects."""
    STATE = "test-state-123"
    USER_ID = "test-user-id"

    redis_instance = fakeredis.aioredis.FakeRedis(decode_responses=True)
    await redis_instance.setex(f"google_oauth_state:{STATE}", 300, USER_ID)

    async def _fake_get_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
        try:
            yield redis_instance
        finally:
            await redis_instance.aclose()

    app = create_app()
    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_redis] = _fake_get_redis
    app.dependency_overrides[get_current_user] = fake_get_current_user

    monkeypatch.setattr(
        GoogleOAuthService,
        "handle_callback",
        AsyncMock(return_value=None),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        follow_redirects=False,
    ) as c:
        response = await c.get(
            "/auth/google/callback", params={"code": "auth-code", "state": STATE}
        )
    assert response.status_code in (302, 307)
    assert "google=connected" in response.headers.get("location", "")


@pytest.mark.asyncio
async def test_get_google_callback_forbidden_returns_403(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When GoogleOAuthForbiddenError is raised, return 403."""
    STATE = "test-state-forbidden"
    USER_ID = "test-user-id"

    redis_instance = fakeredis.aioredis.FakeRedis(decode_responses=True)
    await redis_instance.setex(f"google_oauth_state:{STATE}", 300, USER_ID)

    async def _fake_get_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
        try:
            yield redis_instance
        finally:
            await redis_instance.aclose()

    app = create_app()
    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_redis] = _fake_get_redis
    app.dependency_overrides[get_current_user] = fake_get_current_user

    monkeypatch.setattr(
        GoogleOAuthService,
        "handle_callback",
        AsyncMock(side_effect=GoogleOAuthForbiddenError("forbidden")),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        response = await c.get(
            "/auth/google/callback", params={"code": "auth-code", "state": STATE}
        )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_google_callback_service_error_returns_400(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When ServiceError is raised during callback, return 400."""
    STATE = "test-state-svc-err"
    USER_ID = "test-user-id"

    redis_instance = fakeredis.aioredis.FakeRedis(decode_responses=True)
    await redis_instance.setex(f"google_oauth_state:{STATE}", 300, USER_ID)

    async def _fake_get_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
        try:
            yield redis_instance
        finally:
            await redis_instance.aclose()

    app = create_app()
    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_redis] = _fake_get_redis
    app.dependency_overrides[get_current_user] = fake_get_current_user

    monkeypatch.setattr(
        GoogleOAuthService,
        "handle_callback",
        AsyncMock(side_effect=ServiceError("service error")),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        response = await c.get(
            "/auth/google/callback", params={"code": "auth-code", "state": STATE}
        )
    assert response.status_code == 400
