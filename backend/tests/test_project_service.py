"""Unit tests for project service."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.project import (
    Project,
    ProjectFile,
    ProjectLink,
    ProjectNote,
    ProjectTask,
)
from app.services.errors import NotFoundError
from app.services.project_service import ProjectService
from tests.conftest import FakeAsyncSession, FakeQueryResult


def _project(*, user_id: str = "test-user") -> Project:
    now = datetime.now(tz=UTC)
    return Project(
        project_id=uuid.uuid4(),
        user_id=user_id,
        name="Ozy",
        description="desc",
        instructions=None,
        sensitivity="S1",
        status="active",
        priority="medium",
        color="#58a6ff",
        start_date=date(2026, 4, 1),
        target_date=date(2026, 4, 30),
        completed_date=None,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.asyncio
async def test_create_project_creates_row_with_defaults() -> None:
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))

    created = await service.create_project(user_id="test-user", name="Project One")
    assert created.name == "Project One"
    assert created.user_id == "test-user"
    assert db.commits == 1
    assert db.refreshes == 1


@pytest.mark.asyncio
async def test_list_projects_returns_rows() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[_project()]))
    service = ProjectService(cast(AsyncSession, db))

    items = await service.list_projects(user_id="test-user")
    assert len(items) == 1


@pytest.mark.asyncio
async def test_list_projects_with_status_filter() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[_project()]))
    service = ProjectService(cast(AsyncSession, db))

    items = await service.list_projects(user_id="test-user", status="active")
    assert len(items) == 1


@pytest.mark.asyncio
async def test_get_project_returns_owned_project() -> None:
    project = _project()
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=project))
    service = ProjectService(cast(AsyncSession, db))

    loaded = await service.get_project(project_id=str(project.project_id), user_id="test-user")
    assert loaded.name == "Ozy"


@pytest.mark.asyncio
async def test_get_project_not_found_for_invalid_id() -> None:
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))

    with pytest.raises(NotFoundError):
        await service.get_project(project_id="invalid-uuid", user_id="test-user")


@pytest.mark.asyncio
async def test_update_project_partial_update() -> None:
    project = _project()
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    updated = await service.update_project(
        project_id=str(project.project_id),
        user_id="test-user",
        status="paused",
    )
    assert updated.status == "paused"
    assert db.commits == 1


@pytest.mark.asyncio
async def test_delete_project_deletes_row() -> None:
    project = _project()
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]
    service.list_files = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.delete_project(project_id=str(project.project_id), user_id="test-user")
    assert db.deleted == [project]
    assert db.commits == 1


@pytest.mark.asyncio
async def test_create_task_creates_task() -> None:
    project = _project()
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    task = await service.create_task(
        project_id=str(project.project_id), user_id="test-user", name="Task"
    )
    assert task.name == "Task"
    assert db.commits == 1


@pytest.mark.asyncio
async def test_update_task_changes_status() -> None:
    now = datetime.now(tz=UTC)
    task = ProjectTask(
        task_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id="test-user",
        name="Task",
        description=None,
        status="open",
        priority="medium",
        due_date=None,
        sort_order=0,
        created_at=now,
        updated_at=now,
    )
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service._get_task = AsyncMock(return_value=task)  # type: ignore[method-assign]

    updated = await service.update_task(
        task_id=str(task.task_id), user_id="test-user", status="done"
    )
    assert updated.status == "done"
    assert db.commits == 1


@pytest.mark.asyncio
async def test_update_project_stores_instructions() -> None:
    project = _project()
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    updated = await service.update_project(
        project_id=str(project.project_id),
        user_id="test-user",
        instructions="Always answer in bullet points.",
    )
    assert updated.instructions == "Always answer in bullet points."


@pytest.mark.asyncio
async def test_update_project_clears_instructions_when_set_to_none() -> None:
    project = _project()
    project.instructions = "old"
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    updated = await service.update_project(
        project_id=str(project.project_id),
        user_id="test-user",
        instructions=None,
    )
    assert updated.instructions is None


@pytest.mark.asyncio
async def test_list_conversations_returns_project_chats() -> None:
    project = _project()
    now = datetime.now(tz=UTC)
    chat = Conversation(
        conversation_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Kickoff",
        project_id=project.project_id,
        created_at=now,
        updated_at=now,
    )
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[chat]))
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    chats = await service.list_conversations(
        project_id=str(project.project_id), user_id="test-user"
    )
    assert [item.title for item in chats] == ["Kickoff"]


@pytest.mark.asyncio
async def test_create_file_stores_extracted_knowledge() -> None:
    project = _project()
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    created = await service.create_file(
        project_id=str(project.project_id),
        user_id="test-user",
        filename="spec.md",
        original_name="spec.md",
        content_type="text/markdown",
        size_bytes=12,
        minio_bucket="ozy-files",
        minio_key="projects/p/spec.md",
        extracted_text="The API returns JSON.",
        extract_status="ok",
        text_chars=21,
    )
    assert created.extract_status == "ok"
    assert created.extracted_text == "The API returns JSON."
    assert created.text_chars == 21


@pytest.mark.asyncio
async def test_get_project_with_wrong_user_raises_not_found() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    service = ProjectService(cast(AsyncSession, db))

    with pytest.raises(NotFoundError):
        await service.get_project(
            project_id="00000000-0000-0000-0000-000000000001",
            user_id="another-user",
        )


@pytest.mark.asyncio
async def test_delete_task_deletes_row() -> None:
    now = datetime.now(tz=UTC)
    task = ProjectTask(
        task_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id="test-user",
        name="Task",
        description=None,
        status="open",
        priority="medium",
        due_date=None,
        sort_order=0,
        created_at=now,
        updated_at=now,
    )
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service._get_task = AsyncMock(return_value=task)  # type: ignore[method-assign]

    await service.delete_task(task_id=str(task.task_id), user_id="test-user")
    assert db.deleted == [task]


@pytest.mark.asyncio
async def test_create_note_creates_row() -> None:
    project = _project()
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    note = await service.create_note(
        project_id=str(project.project_id),
        user_id="test-user",
        content="hello",
        source="user",
    )
    assert note.content == "hello"


@pytest.mark.asyncio
async def test_delete_note_deletes_row() -> None:
    note = ProjectNote(
        note_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id="test-user",
        content="hello",
        source="user",
        created_at=datetime.now(tz=UTC),
    )
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service._get_note = AsyncMock(return_value=note)  # type: ignore[method-assign]

    await service.delete_note(note_id=str(note.note_id), user_id="test-user")
    assert db.deleted == [note]


@pytest.mark.asyncio
async def test_create_link_creates_row() -> None:
    project = _project()
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    link = await service.create_link(
        project_id=str(project.project_id),
        user_id="test-user",
        name="Spec",
        url="https://example.com",
    )
    assert link.name == "Spec"


@pytest.mark.asyncio
async def test_delete_link_deletes_row() -> None:
    link = ProjectLink(
        link_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id="test-user",
        name="Spec",
        url="https://example.com",
        created_at=datetime.now(tz=UTC),
    )
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service._get_link = AsyncMock(return_value=link)  # type: ignore[method-assign]

    await service.delete_link(link_id=str(link.link_id), user_id="test-user")
    assert db.deleted == [link]


@pytest.mark.asyncio
async def test_create_file_and_delete_file_record() -> None:
    project = _project()
    file_row = ProjectFile(
        file_id=uuid.uuid4(),
        project_id=project.project_id,
        user_id="test-user",
        filename="safe.pdf",
        original_name="invoice.pdf",
        content_type="application/pdf",
        size_bytes=7,
        minio_bucket="ozy-files",
        minio_key="projects/p/safe.pdf",
        extracted_text=None,
        extract_status="unsupported",
        text_chars=0,
        created_at=datetime.now(tz=UTC),
    )
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]
    created = await service.create_file(
        project_id=str(project.project_id),
        user_id="test-user",
        filename="safe.pdf",
        original_name="invoice.pdf",
        content_type="application/pdf",
        size_bytes=7,
        minio_bucket="ozy-files",
        minio_key="projects/p/safe.pdf",
    )
    assert created.filename == "safe.pdf"

    service.get_file = AsyncMock(return_value=file_row)  # type: ignore[method-assign]
    await service.delete_file_record(
        project_id=str(project.project_id),
        file_id=str(file_row.file_id),
        user_id="test-user",
    )
    assert db.deleted


@pytest.mark.asyncio
async def test_get_file_not_found_raises() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(single=None))
    service = ProjectService(cast(AsyncSession, db))

    with pytest.raises(NotFoundError):
        await service.get_file(
            project_id="00000000-0000-0000-0000-000000000001",
            file_id="00000000-0000-0000-0000-000000000002",
            user_id="test-user",
        )
