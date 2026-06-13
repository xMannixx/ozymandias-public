"""Unit tests for project service."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import (
    Project,
    ProjectFile,
    ProjectLink,
    ProjectMilestone,
    ProjectNote,
    ProjectRisk,
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
async def test_create_milestone_creates_row() -> None:
    project = _project()
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    milestone = await service.create_milestone(
        project_id=str(project.project_id),
        user_id="test-user",
        name="M1",
    )
    assert milestone.name == "M1"
    assert db.commits == 1


@pytest.mark.asyncio
async def test_update_milestone_sets_completed_timestamp() -> None:
    milestone = ProjectMilestone(
        milestone_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id="test-user",
        name="M1",
        due_date=None,
        completed=False,
        completed_at=None,
        sort_order=0,
        created_at=datetime.now(tz=UTC),
    )
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service._get_milestone = AsyncMock(return_value=milestone)  # type: ignore[method-assign]

    updated = await service.update_milestone(
        milestone_id=str(milestone.milestone_id),
        user_id="test-user",
        completed=True,
    )
    assert updated.completed is True
    assert updated.completed_at is not None


@pytest.mark.asyncio
async def test_create_risk_creates_row() -> None:
    project = _project()
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service.get_project = AsyncMock(return_value=project)  # type: ignore[method-assign]

    risk = await service.create_risk(
        project_id=str(project.project_id),
        user_id="test-user",
        name="API risk",
    )
    assert risk.name == "API risk"
    assert db.commits == 1


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
async def test_update_risk_sets_fields() -> None:
    now = datetime.now(tz=UTC)
    risk = ProjectRisk(
        risk_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id="test-user",
        name="Risk",
        description=None,
        severity="medium",
        status="open",
        created_at=now,
        updated_at=now,
    )
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service._get_risk = AsyncMock(return_value=risk)  # type: ignore[method-assign]

    updated = await service.update_risk(
        risk_id=str(risk.risk_id),
        user_id="test-user",
        severity="critical",
    )
    assert updated.severity == "critical"


@pytest.mark.asyncio
async def test_delete_risk_deletes_row() -> None:
    now = datetime.now(tz=UTC)
    risk = ProjectRisk(
        risk_id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        user_id="test-user",
        name="Risk",
        description=None,
        severity="medium",
        status="open",
        created_at=now,
        updated_at=now,
    )
    db = FakeAsyncSession()
    service = ProjectService(cast(AsyncSession, db))
    service._get_risk = AsyncMock(return_value=risk)  # type: ignore[method-assign]

    await service.delete_risk(risk_id=str(risk.risk_id), user_id="test-user")
    assert db.deleted == [risk]


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
