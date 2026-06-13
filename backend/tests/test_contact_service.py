"""Unit tests for contact service."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact, ContactProject
from app.models.project import Project
from app.services.contact_service import ContactService
from app.services.errors import ConflictError, NotFoundError
from tests.conftest import FakeAsyncSession, FakeQueryResult


def _contact(*, user_id: str = "test-user") -> Contact:
    now = datetime.now(tz=UTC)
    return Contact(
        contact_id=uuid.uuid4(),
        user_id=user_id,
        first_name="Ada",
        last_name="Lovelace",
        company="Analytical",
        role="Engineer",
        phones=[{"label": "mobil", "number": "+491701234567"}],
        emails=[{"label": "work", "email": "ada@example.com"}],
        address="London",
        birthday=date(1815, 12, 10),
        notes="Notes",
        tags=["Arbeit", "Tech"],
        avatar_minio_key=None,
        created_at=now,
        updated_at=now,
    )


def _project(*, user_id: str = "test-user") -> Project:
    now = datetime.now(tz=UTC)
    return Project(
        project_id=uuid.uuid4(),
        user_id=user_id,
        name="Proj",
        description=None,
        status="active",
        priority="medium",
        color="#fff",
        start_date=None,
        target_date=None,
        completed_date=None,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_create_contact_defaults() -> None:
    db = FakeAsyncSession()
    service = ContactService(cast(AsyncSession, db))
    created = await service.create_contact(user_id="test-user", first_name="Bob")
    assert created.first_name == "Bob"
    assert created.phones == []
    assert created.emails == []
    assert created.tags == []
    assert db.commits == 1


@pytest.mark.asyncio
async def test_create_contact_stores_phones_emails_jsonb() -> None:
    db = FakeAsyncSession()
    service = ContactService(cast(AsyncSession, db))
    await service.create_contact(
        user_id="test-user",
        first_name="Bob",
        phones=[{"label": "a", "number": "+1"}],
        emails=[{"label": "b", "email": "b@x.de"}],
    )
    row = db.added[0]
    assert isinstance(row, Contact)
    assert row.phones == [{"label": "a", "number": "+1"}]
    assert row.emails == [{"label": "b", "email": "b@x.de"}]


@pytest.mark.asyncio
async def test_list_contacts_sorted() -> None:
    db = FakeAsyncSession()
    c = _contact()
    db.queue_execute_result(FakeQueryResult(values=[c]))
    service = ContactService(cast(AsyncSession, db))
    items = await service.list_contacts(user_id="test-user")
    assert len(items) == 1
    assert items[0].first_name == "Ada"


@pytest.mark.asyncio
async def test_list_contacts_search_queues_query() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[]))
    service = ContactService(cast(AsyncSession, db))
    items = await service.list_contacts(user_id="test-user", search="Ada")
    assert items == []


@pytest.mark.asyncio
async def test_list_contacts_tag_filter() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[]))
    service = ContactService(cast(AsyncSession, db))
    items = await service.list_contacts(user_id="test-user", tag="Arbeit")
    assert items == []


@pytest.mark.asyncio
async def test_get_contact_returns_row() -> None:
    c = _contact()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    loaded = await service.get_contact(str(c.contact_id), user_id="test-user")
    assert loaded.contact_id == c.contact_id


@pytest.mark.asyncio
async def test_get_contact_not_found_invalid_uuid() -> None:
    db = FakeAsyncSession()
    service = ContactService(cast(AsyncSession, db))
    with pytest.raises(NotFoundError):
        await service.get_contact("not-a-uuid", user_id="test-user")


@pytest.mark.asyncio
async def test_get_contact_not_found_wrong_user() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    service = ContactService(cast(AsyncSession, db))
    with pytest.raises(NotFoundError):
        await service.get_contact(str(uuid.uuid4()), user_id="other")


@pytest.mark.asyncio
async def test_update_contact_partial() -> None:
    c = _contact()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    updated = await service.update_contact(str(c.contact_id), user_id="test-user", company="NewCo")
    assert updated.company == "NewCo"
    assert db.commits == 1


@pytest.mark.asyncio
async def test_delete_contact_deletes_avatar_and_row() -> None:
    c = _contact()
    c.avatar_minio_key = "contacts/x/y.png"
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    service.file_service = AsyncMock()
    service.file_service.delete_file = AsyncMock()
    await service.delete_contact(str(c.contact_id), user_id="test-user")
    service.file_service.delete_file.assert_awaited_once_with(minio_key="contacts/x/y.png")
    assert db.deleted
    assert db.commits == 1


@pytest.mark.asyncio
async def test_link_project_inserts_and_conflict_on_duplicate() -> None:
    c = _contact()
    p = _project()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    db.queue_execute_result(FakeQueryResult(single=p))
    db.queue_execute_result(FakeQueryResult(single=None))
    service = ContactService(cast(AsyncSession, db))
    await service.link_project(str(c.contact_id), str(p.project_id), user_id="test-user")
    assert len(db.added) == 1
    assert isinstance(db.added[0], ContactProject)

    db2 = FakeAsyncSession()
    db2.queue_execute_result(FakeQueryResult(single=c))
    db2.queue_execute_result(FakeQueryResult(single=p))
    link = ContactProject(
        contact_id=c.contact_id,
        project_id=p.project_id,
        created_at=datetime.now(tz=UTC),
    )
    db2.queue_execute_result(FakeQueryResult(single=link))
    service2 = ContactService(cast(AsyncSession, db2))
    with pytest.raises(ConflictError):
        await service2.link_project(str(c.contact_id), str(p.project_id), user_id="test-user")


@pytest.mark.asyncio
async def test_unlink_project_not_found() -> None:
    c = _contact()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    db.queue_execute_result(FakeQueryResult(single=None))
    service = ContactService(cast(AsyncSession, db))
    with pytest.raises(NotFoundError):
        await service.unlink_project(str(c.contact_id), str(uuid.uuid4()), user_id="test-user")


@pytest.mark.asyncio
async def test_unlink_project_success() -> None:
    c = _contact()
    p = _project()
    link = ContactProject(
        contact_id=c.contact_id,
        project_id=p.project_id,
        created_at=datetime.now(tz=UTC),
    )
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    db.queue_execute_result(FakeQueryResult(single=link))
    service = ContactService(cast(AsyncSession, db))
    await service.unlink_project(str(c.contact_id), str(p.project_id), user_id="test-user")
    assert link in db.deleted
    assert db.commits == 1


@pytest.mark.asyncio
async def test_update_contact_phones_emails_tags() -> None:
    c = _contact()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    updated = await service.update_contact(
        str(c.contact_id),
        user_id="test-user",
        phones=[{"label": "mobil", "number": "+4900"}],
        emails=[{"label": "work", "email": "new@example.com"}],
        tags=["Tag1"],
    )
    assert updated.phones == [{"label": "mobil", "number": "+4900"}]
    assert updated.emails == [{"label": "work", "email": "new@example.com"}]
    assert updated.tags == ["Tag1"]


def test_json_list_with_none_returns_empty() -> None:
    from app.services.contact_service import _json_list

    assert _json_list(None) == []


def test_json_list_with_non_list_returns_empty() -> None:
    from app.services.contact_service import _json_list

    assert _json_list("not-a-list") == []


@pytest.mark.asyncio
async def test_delete_contact_handles_not_found_on_avatar_delete() -> None:
    c = _contact()
    c.avatar_minio_key = "contacts/x/y.png"
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    file_service_mock = AsyncMock()
    file_service_mock.delete_file = AsyncMock(side_effect=NotFoundError("not found"))
    service.file_service = file_service_mock
    # Should not raise even when file_service.delete_file raises NotFoundError
    await service.delete_contact(str(c.contact_id), user_id="test-user")
    assert db.commits == 1


@pytest.mark.asyncio
async def test_set_avatar_replaces_existing_avatar() -> None:
    c = _contact()
    c.avatar_minio_key = "old-key"
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    service.file_service = AsyncMock()
    service.file_service.delete_file = AsyncMock()
    updated = await service.set_avatar(str(c.contact_id), user_id="test-user", minio_key="new-key")
    service.file_service.delete_file.assert_awaited_once_with(minio_key="old-key")
    assert updated.avatar_minio_key == "new-key"


@pytest.mark.asyncio
async def test_set_avatar_same_key_no_delete() -> None:
    c = _contact()
    c.avatar_minio_key = "same-key"
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    service.file_service = AsyncMock()
    service.file_service.delete_file = AsyncMock()
    await service.set_avatar(str(c.contact_id), user_id="test-user", minio_key="same-key")
    service.file_service.delete_file.assert_not_awaited()


@pytest.mark.asyncio
async def test_delete_avatar_removes_existing_avatar() -> None:
    c = _contact()
    c.avatar_minio_key = "existing-key"
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    service.file_service = AsyncMock()
    service.file_service.delete_file = AsyncMock()
    updated = await service.delete_avatar(str(c.contact_id), user_id="test-user")
    service.file_service.delete_file.assert_awaited_once_with(minio_key="existing-key")
    assert updated.avatar_minio_key is None


@pytest.mark.asyncio
async def test_delete_avatar_no_avatar_does_nothing() -> None:
    c = _contact()
    c.avatar_minio_key = None
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    service.file_service = AsyncMock()
    service.file_service.delete_file = AsyncMock()
    await service.delete_avatar(str(c.contact_id), user_id="test-user")
    service.file_service.delete_file.assert_not_awaited()


@pytest.mark.asyncio
async def test_get_owned_project_not_found_raises() -> None:
    c = _contact()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    db.queue_execute_result(FakeQueryResult(single=None))  # project not found
    service = ContactService(cast(AsyncSession, db))
    with pytest.raises(NotFoundError):
        await service.link_project(str(c.contact_id), str(uuid.uuid4()), user_id="test-user")


@pytest.mark.asyncio
async def test_delete_avatar_handles_not_found_on_file_delete() -> None:
    c = _contact()
    c.avatar_minio_key = "key"
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    service = ContactService(cast(AsyncSession, db))
    service.file_service = AsyncMock()
    service.file_service.delete_file = AsyncMock(side_effect=NotFoundError("gone"))
    # Should not raise
    updated = await service.delete_avatar(str(c.contact_id), user_id="test-user")
    assert updated.avatar_minio_key is None


@pytest.mark.asyncio
async def test_list_linked_projects() -> None:
    c = _contact()
    p = _project()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=c))
    db.queue_execute_result(FakeQueryResult(values=[p]))
    service = ContactService(cast(AsyncSession, db))
    items = await service.list_linked_projects(str(c.contact_id), user_id="test-user")
    assert len(items) == 1
    assert items[0].name == "Proj"
