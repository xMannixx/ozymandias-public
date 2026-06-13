"""Unit tests for Google OAuth service."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.google_oauth import GoogleOAuthForbiddenError, GoogleOAuthService
from app.models.google_tokens import GoogleToken
from app.services.utils import normalize_user_id
from tests.conftest import FakeAsyncSession, FakeQueryResult


class _FlowUrlStub:
    def authorization_url(self, **kwargs: object) -> tuple[str, str]:
        assert kwargs["state"] == "state-1"
        return ("https://accounts.google.com/o/oauth2/v2/auth?state=state-1", "state-1")


class _FlowCallbackStub:
    def __init__(self, credentials: object) -> None:
        self.credentials = credentials
        self.last_code: str | None = None

    def fetch_token(self, *, code: str) -> None:
        self.last_code = code


@pytest.mark.asyncio
async def test_get_auth_url_returns_google_url(monkeypatch: pytest.MonkeyPatch) -> None:
    service = GoogleOAuthService()
    monkeypatch.setattr(service, "_build_flow", lambda state: _FlowUrlStub())
    url = service.get_auth_url("state-1")
    assert "accounts.google.com" in url
    assert "state=state-1" in url


@pytest.mark.asyncio
async def test_handle_callback_exchanges_code_and_stores_tokens(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    credentials = SimpleNamespace(
        token="access-1",
        refresh_token="refresh-1",
        scopes=["scope.a", "scope.b"],
        expiry=datetime.now(tz=UTC) + timedelta(minutes=30),
        id_token="id-token",
    )
    flow = _FlowCallbackStub(credentials=credentials)
    service = GoogleOAuthService()
    monkeypatch.setattr(service, "_build_flow", lambda state: flow)
    monkeypatch.setattr(service, "_extract_email", AsyncMock(return_value="owner@example.com"))
    monkeypatch.setattr(service, "_enforce_owner", lambda email: None)

    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))

    result = await service.handle_callback(
        code="oauth-code",
        state="state-1",
        user_id="dev-user",
        db=cast(AsyncSession, db),
    )
    assert flow.last_code == "oauth-code"
    assert result == {"email": "owner@example.com", "scopes": ["scope.a", "scope.b"]}
    assert db.commits == 1
    assert len(db.added) == 1
    token_row = db.added[0]
    assert isinstance(token_row, GoogleToken)
    assert token_row.user_id == str(normalize_user_id("dev-user"))
    assert token_row.access_token == "access-1"


@pytest.mark.asyncio
async def test_handle_callback_rejects_foreign_owner_email(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.auth.google_oauth.get_settings",
        lambda: SimpleNamespace(
            google_client_id="id",
            google_client_secret="secret",
            google_redirect_uri="http://localhost:8000/auth/google/callback",
            owner_email="owner@example.com",
        ),
    )
    credentials = SimpleNamespace(
        token="access-1",
        refresh_token="refresh-1",
        scopes=["scope.a"],
        expiry=datetime.now(tz=UTC) + timedelta(minutes=30),
        id_token="id-token",
    )
    flow = _FlowCallbackStub(credentials=credentials)
    service = GoogleOAuthService()
    monkeypatch.setattr(service, "_build_flow", lambda state: flow)
    monkeypatch.setattr(service, "_extract_email", AsyncMock(return_value="other@example.com"))

    with pytest.raises(GoogleOAuthForbiddenError):
        await service.handle_callback(
            code="oauth-code",
            state="state-1",
            user_id="dev-user",
            db=cast(AsyncSession, FakeAsyncSession()),
        )


@pytest.mark.asyncio
async def test_get_valid_credentials_returns_credentials_without_refresh(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _CredentialsStub:
        def __init__(self, **kwargs: object) -> None:
            self.token = kwargs["token"]
            self.refresh_token = kwargs["refresh_token"]
            self.scopes = kwargs["scopes"]
            self.expired = False
            self.expiry: datetime | None = None

    service = GoogleOAuthService()
    monkeypatch.setattr(service, "_ensure_google_dependencies", lambda: None)
    monkeypatch.setattr("app.auth.google_oauth.GoogleCredentials", _CredentialsStub)

    db = FakeAsyncSession()
    db.queue_execute_result(
        FakeQueryResult(
            single=SimpleNamespace(
                user_id=str(normalize_user_id("dev-user")),
                access_token="access-1",
                refresh_token="refresh-1",
                token_expiry=datetime.now(tz=UTC) + timedelta(minutes=45),
                scopes="scope.a scope.b",
                updated_at=datetime.now(tz=UTC),
            )
        )
    )

    credentials = await service.get_valid_credentials(user_id="dev-user", db=cast(AsyncSession, db))
    assert credentials.token == "access-1"
    assert credentials.refresh_token == "refresh-1"
    assert credentials.scopes == ["scope.a", "scope.b"]
    assert db.commits == 0


@pytest.mark.asyncio
async def test_get_valid_credentials_refreshes_expired_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _CredentialsStub:
        def __init__(self, **kwargs: object) -> None:
            self.token = kwargs["token"]
            self.refresh_token = kwargs["refresh_token"]
            self.scopes = kwargs["scopes"]
            self.expired = True
            self.expiry: datetime | None = None

        def refresh(self, _request: object) -> None:
            self.token = "access-new"
            self.refresh_token = "refresh-new"
            self.scopes = ["scope.a", "scope.b"]
            self.expiry = datetime.now(tz=UTC) + timedelta(minutes=60)
            self.expired = False

    service = GoogleOAuthService()
    monkeypatch.setattr(service, "_ensure_google_dependencies", lambda: None)
    monkeypatch.setattr("app.auth.google_oauth.GoogleCredentials", _CredentialsStub)
    monkeypatch.setattr("app.auth.google_oauth.GoogleAuthRequest", lambda: object())

    row = SimpleNamespace(
        user_id=str(normalize_user_id("dev-user")),
        access_token="access-old",
        refresh_token="refresh-old",
        token_expiry=datetime.now(tz=UTC) - timedelta(minutes=1),
        scopes="scope.a",
        updated_at=datetime.now(tz=UTC),
    )
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=row))

    credentials = await service.get_valid_credentials(user_id="dev-user", db=cast(AsyncSession, db))
    assert credentials.token == "access-new"
    assert row.access_token == "access-new"
    assert row.refresh_token == "refresh-new"
    assert db.commits == 1


@pytest.mark.asyncio
async def test_google_status_returns_false_without_tokens() -> None:
    service = GoogleOAuthService()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))

    payload = await service.status(user_id="dev-user", db=cast(AsyncSession, db))
    assert payload["connected"] is False
    assert payload["email"] is None
    assert payload["scopes"] == []
