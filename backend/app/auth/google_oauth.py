"""Google OAuth service for Gmail and Calendar connectors."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, cast

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.google_tokens import GoogleToken
from app.services.errors import ServiceError, ValidationError
from app.services.utils import normalize_user_id

if TYPE_CHECKING:
    from google.oauth2.credentials import Credentials as GoogleCredentialsType
else:
    GoogleCredentialsType = Any

GoogleAuthRequest: Any | None = None
google_id_token: Any | None = None
GoogleCredentials: Any | None = None
Flow: Any | None = None

try:
    from google.auth.transport.requests import Request as GoogleAuthRequest
    from google.oauth2 import id_token as google_id_token
    from google.oauth2.credentials import Credentials as GoogleCredentials
    from google_auth_oauthlib.flow import Flow as GoogleFlow

    Flow = GoogleFlow
except ImportError:  # pragma: no cover - exercised only when deps are missing
    pass


class GoogleOAuthForbiddenError(ServiceError):
    """Raised when a non-owner Google account tries to connect."""


class GoogleOAuthService:
    """OAuth helper for generating auth URL and storing Google tokens."""

    SCOPES = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events",
    ]

    def __init__(self) -> None:
        self.settings = get_settings()

    def get_auth_url(self, state: str) -> str:
        """Build and return Google authorization URL with CSRF state."""
        flow = self._build_flow(state=state)
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=state,
        )
        return str(auth_url)

    async def handle_callback(
        self,
        *,
        code: str,
        state: str,
        user_id: str,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Exchange callback code for tokens and persist credentials."""
        flow = self._build_flow(state=state)
        await asyncio.to_thread(flow.fetch_token, code=code)
        credentials = flow.credentials
        if credentials is None:
            raise ValidationError("Google callback did not return credentials")
        email = await self._extract_email(credentials)
        self._enforce_owner(email)

        normalized_user_id = str(normalize_user_id(user_id))
        scopes = self._serialize_scopes(credentials.scopes or self.SCOPES)
        token_expiry = self._credential_expiry(credentials)

        result = await db.execute(
            select(GoogleToken).where(GoogleToken.user_id == normalized_user_id)
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            existing = GoogleToken(
                user_id=normalized_user_id,
                access_token=str(credentials.token or ""),
                refresh_token=str(credentials.refresh_token or ""),
                token_expiry=token_expiry,
                scopes=scopes,
            )
            db.add(existing)
        else:
            existing.access_token = str(credentials.token or "")
            if credentials.refresh_token:
                existing.refresh_token = str(credentials.refresh_token)
            existing.token_expiry = token_expiry
            existing.scopes = scopes
            existing.updated_at = datetime.now(tz=UTC)

        await db.commit()
        return {"email": email, "scopes": self._deserialize_scopes(scopes)}

    async def get_valid_credentials(
        self, *, user_id: str, db: AsyncSession
    ) -> GoogleCredentialsType:
        """Load credentials from DB and refresh them if needed."""
        self._ensure_google_dependencies()
        normalized_user_id = str(normalize_user_id(user_id))
        result = await db.execute(
            select(GoogleToken).where(GoogleToken.user_id == normalized_user_id)
        )
        token_row = result.scalar_one_or_none()
        if token_row is None:
            raise ServiceError("Google account is not connected")

        if GoogleCredentials is None:
            raise ServiceError(
                "Google OAuth dependencies are missing; "
                "install google-auth and google-auth-oauthlib"
            )
        credentials_class = cast(Any, GoogleCredentials)
        credentials = credentials_class(
            token=token_row.access_token,
            refresh_token=token_row.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",  # nosec B106
            client_id=self.settings.google_client_id,
            client_secret=self.settings.google_client_secret,
            scopes=self._deserialize_scopes(token_row.scopes),
        )
        credentials.expiry = token_row.token_expiry
        if credentials.expired and credentials.refresh_token:
            if GoogleAuthRequest is None:
                raise ServiceError("Google OAuth request transport is not available")
            refresh_request = GoogleAuthRequest()
            await asyncio.to_thread(credentials.refresh, refresh_request)
            token_row.access_token = str(credentials.token or token_row.access_token)
            if credentials.refresh_token:
                token_row.refresh_token = str(credentials.refresh_token)
            token_row.token_expiry = self._credential_expiry(credentials)
            token_row.scopes = self._serialize_scopes(credentials.scopes or self.SCOPES)
            token_row.updated_at = datetime.now(tz=UTC)
            await db.commit()
        return cast(GoogleCredentialsType, credentials)

    async def status(self, *, user_id: str, db: AsyncSession) -> dict[str, Any]:
        """Return connector status for one user."""
        normalized_user_id = str(normalize_user_id(user_id))
        result = await db.execute(
            select(GoogleToken).where(GoogleToken.user_id == normalized_user_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return {"connected": False, "email": None, "scopes": []}
        return {
            "connected": True,
            "email": self.settings.owner_email or None,
            "scopes": self._deserialize_scopes(row.scopes),
        }

    async def disconnect(self, *, user_id: str, db: AsyncSession) -> bool:
        """Remove persisted Google credentials for one user."""
        normalized_user_id = str(normalize_user_id(user_id))
        result = await db.execute(
            select(GoogleToken).where(GoogleToken.user_id == normalized_user_id)
        )
        existing = result.scalar_one_or_none()
        if existing is not None:
            await db.execute(delete(GoogleToken).where(GoogleToken.user_id == normalized_user_id))
        await db.commit()
        return existing is not None

    def _build_flow(self, *, state: str) -> Any:
        self._ensure_google_dependencies()
        if not self.settings.google_client_id or not self.settings.google_client_secret:
            raise ServiceError("Google OAuth is not configured")
        if Flow is None:
            raise ServiceError("Google OAuth flow dependency is not available")
        flow_class = cast(Any, Flow)
        flow = flow_class.from_client_config(
            {
                "web": {
                    "client_id": self.settings.google_client_id,
                    "client_secret": self.settings.google_client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",  # nosec B105
                    "redirect_uris": [self.settings.google_redirect_uri],
                }
            },
            scopes=self.SCOPES,
            state=state,
        )
        flow.redirect_uri = self.settings.google_redirect_uri
        return flow

    async def _extract_email(self, credentials: Any) -> str:
        if not credentials.id_token or google_id_token is None or GoogleAuthRequest is None:
            raise ValidationError("Google callback did not include a verifiable ID token")
        info = await asyncio.to_thread(
            google_id_token.verify_oauth2_token,
            credentials.id_token,
            GoogleAuthRequest(),
            self.settings.google_client_id,
        )
        email_value = info.get("email")
        if not isinstance(email_value, str) or not email_value:
            raise ValidationError("Google ID token does not include an email")
        return email_value

    def _enforce_owner(self, email: str) -> None:
        owner_email = self.settings.owner_email.strip().lower()
        if owner_email and email.lower() != owner_email:
            raise GoogleOAuthForbiddenError("Google account is not allowed for this workspace")

    def _credential_expiry(self, credentials: Any) -> datetime:
        expiry = getattr(credentials, "expiry", None)
        if isinstance(expiry, datetime):
            if expiry.tzinfo is None:
                return expiry.replace(tzinfo=UTC)
            return expiry
        return datetime.now(tz=UTC) + timedelta(hours=1)

    def _serialize_scopes(self, scopes: list[str]) -> str:
        return " ".join(scope.strip() for scope in scopes if scope.strip())

    def _deserialize_scopes(self, value: str) -> list[str]:
        return [item for item in value.split(" ") if item]

    def _ensure_google_dependencies(self) -> None:
        if Flow is None or GoogleAuthRequest is None:
            raise ServiceError(
                "Google OAuth dependencies are missing; "
                "install google-auth and google-auth-oauthlib"
            )
