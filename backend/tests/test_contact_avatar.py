"""API tests for contact avatar upload and delete."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.models.contact import Contact
from app.services.audit_service import AuditService
from app.services.contact_service import ContactService


def _contact(*, avatar_key: str | None = None) -> Contact:
    now = datetime.now(tz=UTC)
    return Contact(
        contact_id=uuid.uuid4(),
        user_id="test-user-id",
        first_name="Max",
        last_name=None,
        company=None,
        role=None,
        phones=[],
        emails=[],
        address=None,
        birthday=None,
        notes=None,
        tags=[],
        avatar_minio_key=avatar_key,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_post_contact_avatar_returns_200_with_has_avatar(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    base = _contact()
    with_avatar = _contact(avatar_key="contacts/cid/k.png")
    monkeypatch.setattr(ContactService, "get_contact", AsyncMock(return_value=base))
    monkeypatch.setattr(ContactService, "set_avatar", AsyncMock(return_value=with_avatar))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    class _MockFileService:
        async def upload_file(
            self,
            *,
            project_id: str,
            user_id: str,
            filename: str,
            data: bytes,
            content_type: str,
            prefix: str = "projects",
        ) -> dict[str, str | int]:
            assert prefix == "contacts"
            assert project_id == str(base.contact_id)
            return {
                "minio_bucket": "b",
                "minio_key": "contacts/cid/k.png",
                "size_bytes": len(data),
                "filename": "f",
                "original_name": "a.png",
                "content_type": "image/png",
            }

    monkeypatch.setattr("app.api.contacts.FileService", _MockFileService)

    files = {"file": ("a.png", b"\x89PNG\r\n\x1a\n", "image/png")}
    response = await client.post(f"/contacts/{base.contact_id}/avatar", files=files)
    assert response.status_code == 200
    assert response.json()["has_avatar"] is True


@pytest.mark.asyncio
async def test_delete_contact_avatar_returns_204(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    c = _contact(avatar_key="contacts/x/y.png")
    monkeypatch.setattr(ContactService, "delete_avatar", AsyncMock(return_value=c))
    monkeypatch.setattr(AuditService, "log", AsyncMock())
    response = await client.delete(f"/contacts/{c.contact_id}/avatar")
    assert response.status_code == 204
