"""API tests for projects endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.models.conversation import Conversation
from app.models.project import (
    Project,
    ProjectFile,
    ProjectLink,
    ProjectNote,
    ProjectTask,
)
from app.services.audit_service import AuditService
from app.services.errors import NotFoundError
from app.services.project_service import ProjectService


def _project() -> Project:
    now = datetime.now(tz=UTC)
    return Project(
        project_id=uuid.uuid4(),
        user_id="test-user-id",
        name="Project Alpha",
        description="desc",
        instructions="Answer in German.",
        sensitivity="S2",
        status="active",
        priority="medium",
        color="#58a6ff",
        start_date=date(2026, 4, 1),
        target_date=date(2026, 5, 1),
        completed_date=None,
        created_at=now,
        updated_at=now,
    )


def _task(project_id: uuid.UUID, *, due_date: date | None = None) -> ProjectTask:
    now = datetime.now(tz=UTC)
    return ProjectTask(
        task_id=uuid.uuid4(),
        project_id=project_id,
        user_id="test-user-id",
        name="Task A",
        description=None,
        status="open",
        priority="medium",
        due_date=due_date,
        sort_order=0,
        created_at=now,
        updated_at=now,
    )


def _chat(project_id: uuid.UUID) -> Conversation:
    now = datetime.now(tz=UTC)
    return Conversation(
        conversation_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        title="Kickoff",
        project_id=project_id,
        created_at=now,
        updated_at=now,
    )


def _knowledge_file(project_id: uuid.UUID) -> ProjectFile:
    return ProjectFile(
        file_id=uuid.uuid4(),
        project_id=project_id,
        user_id="test-user-id",
        filename="spec.md",
        original_name="spec.md",
        content_type="text/markdown",
        size_bytes=20,
        minio_bucket="ozy-files",
        minio_key="projects/p/spec.md",
        extracted_text="The API returns JSON.",
        extract_status="ok",
        text_chars=21,
        created_at=datetime.now(tz=UTC),
    )


def _note(project_id: uuid.UUID) -> ProjectNote:
    return ProjectNote(
        note_id=uuid.uuid4(),
        project_id=project_id,
        user_id="test-user-id",
        content="hello",
        source="user",
        created_at=datetime.now(tz=UTC),
    )


def _link(project_id: uuid.UUID) -> ProjectLink:
    return ProjectLink(
        link_id=uuid.uuid4(),
        project_id=project_id,
        user_id="test-user-id",
        name="Spec",
        url="https://example.com",
        created_at=datetime.now(tz=UTC),
    )


def _patch_common_project_lists(
    monkeypatch: pytest.MonkeyPatch,
    *,
    project_id: uuid.UUID,
) -> None:
    monkeypatch.setattr(
        ProjectService,
        "list_tasks",
        AsyncMock(return_value=[_task(project_id, due_date=date(2026, 4, 20))]),
    )
    monkeypatch.setattr(ProjectService, "list_notes", AsyncMock(return_value=[_note(project_id)]))
    monkeypatch.setattr(
        ProjectService,
        "list_files",
        AsyncMock(return_value=[_knowledge_file(project_id)]),
    )
    monkeypatch.setattr(ProjectService, "list_links", AsyncMock(return_value=[_link(project_id)]))
    monkeypatch.setattr(
        ProjectService,
        "list_conversations",
        AsyncMock(return_value=[_chat(project_id)]),
    )


@pytest.mark.asyncio
async def test_get_projects_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    monkeypatch.setattr(ProjectService, "list_projects", AsyncMock(return_value=[project]))
    _patch_common_project_lists(monkeypatch, project_id=project.project_id)

    response = await client.get("/projects")
    assert response.status_code == 200
    body = response.json()[0]
    assert body["name"] == "Project Alpha"
    assert body["instructions"] == "Answer in German."
    assert body["sensitivity"] == "S2"
    assert body["knowledge_count"] == 1
    assert body["chat_count"] == 1
    assert body["next_due_task"] == "Task A"


@pytest.mark.asyncio
async def test_post_projects_returns_201(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    monkeypatch.setattr(ProjectService, "create_project", AsyncMock(return_value=project))
    _patch_common_project_lists(monkeypatch, project_id=project.project_id)
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.post("/projects", json={"name": "Project Alpha"})
    assert response.status_code == 201
    assert response.json()["project_id"] == str(project.project_id)


@pytest.mark.asyncio
async def test_get_project_detail_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    monkeypatch.setattr(ProjectService, "get_project", AsyncMock(return_value=project))
    _patch_common_project_lists(monkeypatch, project_id=project.project_id)

    response = await client.get(f"/projects/{project.project_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["project_id"] == str(project.project_id)
    assert len(body["chats"]) == 1
    assert body["files"][0]["extract_status"] == "ok"
    assert body["files"][0]["text_chars"] == 21
    assert "milestones" not in body
    assert "risks" not in body


@pytest.mark.asyncio
async def test_patch_project_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    project.status = "paused"
    monkeypatch.setattr(ProjectService, "update_project", AsyncMock(return_value=project))
    _patch_common_project_lists(monkeypatch, project_id=project.project_id)
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.patch(f"/projects/{project.project_id}", json={"status": "paused"})
    assert response.status_code == 200
    assert response.json()["status"] == "paused"


@pytest.mark.asyncio
async def test_delete_project_returns_204(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ProjectService, "delete_project", AsyncMock(return_value=None))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.delete("/projects/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_post_project_tasks_returns_201(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    task = _task(project.project_id)
    monkeypatch.setattr(ProjectService, "create_task", AsyncMock(return_value=task))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.post(
        f"/projects/{project.project_id}/tasks",
        json={"name": "Task A"},
    )
    assert response.status_code == 201
    assert response.json()["task_id"] == str(task.task_id)


@pytest.mark.asyncio
async def test_patch_project_saves_instructions(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    project.instructions = "Always cite the spec."
    update = AsyncMock(return_value=project)
    monkeypatch.setattr(ProjectService, "update_project", update)
    _patch_common_project_lists(monkeypatch, project_id=project.project_id)
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.patch(
        f"/projects/{project.project_id}",
        json={"instructions": "Always cite the spec."},
    )
    assert response.status_code == 200
    assert response.json()["instructions"] == "Always cite the spec."
    assert update.await_args.kwargs["instructions"] == "Always cite the spec."


@pytest.mark.asyncio
async def test_patch_project_rejects_unknown_sensitivity(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    monkeypatch.setattr(ProjectService, "update_project", AsyncMock(return_value=project))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.patch(
        f"/projects/{project.project_id}",
        json={"sensitivity": "S9"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_project_chats_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    chat = _chat(project.project_id)
    monkeypatch.setattr(ProjectService, "list_conversations", AsyncMock(return_value=[chat]))

    response = await client.get(f"/projects/{project.project_id}/chats")
    assert response.status_code == 200
    assert response.json()[0]["conversation_id"] == str(chat.conversation_id)
    assert response.json()[0]["title"] == "Kickoff"


@pytest.mark.asyncio
async def test_get_project_chats_for_foreign_project_returns_404(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ProjectService,
        "list_conversations",
        AsyncMock(side_effect=NotFoundError("Project not found")),
    )

    response = await client.get("/projects/00000000-0000-0000-0000-000000000001/chats")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_post_project_notes_returns_201(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    note = _note(project.project_id)
    monkeypatch.setattr(ProjectService, "create_note", AsyncMock(return_value=note))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.post(
        f"/projects/{project.project_id}/notes",
        json={"content": "hello", "source": "user"},
    )
    assert response.status_code == 201
    assert response.json()["note_id"] == str(note.note_id)


@pytest.mark.asyncio
async def test_post_project_links_returns_201(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    link = _link(project.project_id)
    monkeypatch.setattr(ProjectService, "create_link", AsyncMock(return_value=link))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.post(
        f"/projects/{project.project_id}/links",
        json={"name": "Spec", "url": "https://example.com"},
    )
    assert response.status_code == 201
    assert response.json()["link_id"] == str(link.link_id)


@pytest.mark.asyncio
async def test_get_project_with_foreign_user_returns_404(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ProjectService,
        "get_project",
        AsyncMock(side_effect=NotFoundError("Project not found")),
    )

    response = await client.get("/projects/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_with_foreign_user_returns_404(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ProjectService,
        "delete_project",
        AsyncMock(side_effect=NotFoundError("Project not found")),
    )

    response = await client.delete("/projects/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_project_tasks_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    task = _task(project.project_id)
    monkeypatch.setattr(ProjectService, "list_tasks", AsyncMock(return_value=[task]))

    response = await client.get(f"/projects/{project.project_id}/tasks")
    assert response.status_code == 200
    assert response.json()[0]["task_id"] == str(task.task_id)


@pytest.mark.asyncio
async def test_patch_project_task_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    task = _task(project.project_id)
    monkeypatch.setattr(ProjectService, "update_task", AsyncMock(return_value=task))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.patch(
        f"/projects/{project.project_id}/tasks/{task.task_id}",
        json={"status": "done"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_project_task_returns_204(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ProjectService, "delete_task", AsyncMock(return_value=None))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.delete(
        "/projects/00000000-0000-0000-0000-000000000001/tasks/00000000-0000-0000-0000-000000000002"
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_get_project_notes_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    note = _note(project.project_id)
    monkeypatch.setattr(ProjectService, "list_notes", AsyncMock(return_value=[note]))

    response = await client.get(f"/projects/{project.project_id}/notes")
    assert response.status_code == 200
    assert response.json()[0]["note_id"] == str(note.note_id)


@pytest.mark.asyncio
async def test_delete_project_note_returns_204(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ProjectService, "delete_note", AsyncMock(return_value=None))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.delete(
        "/projects/00000000-0000-0000-0000-000000000001/notes/00000000-0000-0000-0000-000000000002"
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_get_project_links_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project = _project()
    link = _link(project.project_id)
    monkeypatch.setattr(ProjectService, "list_links", AsyncMock(return_value=[link]))

    response = await client.get(f"/projects/{project.project_id}/links")
    assert response.status_code == 200
    assert response.json()[0]["link_id"] == str(link.link_id)


@pytest.mark.asyncio
async def test_delete_project_link_returns_204(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(ProjectService, "delete_link", AsyncMock(return_value=None))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.delete(
        "/projects/00000000-0000-0000-0000-000000000001/links/00000000-0000-0000-0000-000000000002"
    )
    assert response.status_code == 204
