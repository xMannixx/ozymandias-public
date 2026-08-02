"""API tests for contacts endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.models.contact import Contact
from app.services.audit_service import AuditService
from app.services.contact_service import ContactService
from app.services.errors import ConflictError, NotFoundError


def _contact() -> Contact:
    now = datetime.now(tz=UTC)
    return Contact(
        contact_id=uuid.uuid4(),
        user_id="test-user-id",
        first_name="Max",
        last_name="Mustermann",
        company="ACME",
        role="Dev",
        phones=[{"label": "mobil", "number": "+491701234567"}],
        emails=[{"label": "privat", "email": "max@example.de"}],
        address="Berlin",
        birthday=None,
        notes="Hi",
        tags=["Kunde"],
        avatar_minio_key=None,
        sensitivity="S2",
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_get_contacts_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    c = _contact()
    monkeypatch.setattr(ContactService, "list_contacts", AsyncMock(return_value=[c]))
    response = await client.get("/contacts")
    assert response.status_code == 200
    assert response.json()[0]["first_name"] == "Max"


@pytest.mark.asyncio
async def test_post_contacts_returns_201(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    c = _contact()
    monkeypatch.setattr(ContactService, "create_contact", AsyncMock(return_value=c))
    monkeypatch.setattr(AuditService, "log", AsyncMock())
    response = await client.post("/contacts", json={"first_name": "Max"})
    assert response.status_code == 201
    assert response.json()["contact_id"] == str(c.contact_id)


@pytest.mark.asyncio
async def test_post_contacts_defaults_to_s2(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Contact data is personal, so a new contact starts at S2 without being asked."""
    create = AsyncMock(return_value=_contact())
    monkeypatch.setattr(ContactService, "create_contact", create)
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.post("/contacts", json={"first_name": "Max"})

    assert response.status_code == 201
    assert create.await_args is not None
    assert create.await_args.kwargs["sensitivity"] == "S2"
    assert response.json()["sensitivity"] == "S2"


@pytest.mark.asyncio
async def test_patch_contacts_rejects_an_unknown_privacy_level(
    client: AsyncClient,
) -> None:
    response = await client.patch(f"/contacts/{uuid.uuid4()}", json={"sensitivity": "S9"})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_patch_contacts_marks_a_contact_private(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    c = _contact()
    c.sensitivity = "S3"
    monkeypatch.setattr(ContactService, "update_contact", AsyncMock(return_value=c))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.patch(f"/contacts/{c.contact_id}", json={"sensitivity": "S3"})

    assert response.status_code == 200
    assert response.json()["sensitivity"] == "S3"


@pytest.mark.asyncio
async def test_get_contact_detail_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    c = _contact()
    monkeypatch.setattr(ContactService, "get_contact", AsyncMock(return_value=c))
    monkeypatch.setattr(ContactService, "list_linked_projects", AsyncMock(return_value=[]))
    response = await client.get(f"/contacts/{c.contact_id}")
    assert response.status_code == 200
    assert response.json()["linked_projects"] == []
    assert response.json()["notes"] == "Hi"


@pytest.mark.asyncio
async def test_patch_contact_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    c = _contact()
    c.company = "NewCo"
    monkeypatch.setattr(ContactService, "update_contact", AsyncMock(return_value=c))
    monkeypatch.setattr(AuditService, "log", AsyncMock())
    response = await client.patch(f"/contacts/{c.contact_id}", json={"company": "NewCo"})
    assert response.status_code == 200
    assert response.json()["company"] == "NewCo"


@pytest.mark.asyncio
async def test_delete_contact_returns_204(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ContactService, "delete_contact", AsyncMock(return_value=None))
    monkeypatch.setattr(AuditService, "log", AsyncMock())
    response = await client.delete(f"/contacts/{uuid.uuid4()}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_post_contact_projects_returns_201(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cid = str(uuid.uuid4())
    pid = str(uuid.uuid4())
    monkeypatch.setattr(ContactService, "link_project", AsyncMock(return_value=None))
    monkeypatch.setattr(AuditService, "log", AsyncMock())
    response = await client.post(f"/contacts/{cid}/projects", json={"project_id": pid})
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_delete_contact_projects_returns_204(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cid = str(uuid.uuid4())
    pid = str(uuid.uuid4())
    monkeypatch.setattr(ContactService, "unlink_project", AsyncMock(return_value=None))
    monkeypatch.setattr(AuditService, "log", AsyncMock())
    response = await client.delete(f"/contacts/{cid}/projects/{pid}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_get_contact_404_wrong_user_service(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ContactService,
        "get_contact",
        AsyncMock(side_effect=NotFoundError("Contact not found")),
    )
    response = await client.get(f"/contacts/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_post_contact_projects_409_on_duplicate(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cid = str(uuid.uuid4())
    pid = str(uuid.uuid4())
    monkeypatch.setattr(
        ContactService,
        "link_project",
        AsyncMock(side_effect=ConflictError("Project already linked")),
    )
    response = await client.post(f"/contacts/{cid}/projects", json={"project_id": pid})
    assert response.status_code == 409
