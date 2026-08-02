"""Tests for the workspace context injected into a project chat."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project, ProjectFile, ProjectLink, ProjectNote, ProjectTask
from app.services.project_context_service import (
    KNOWLEDGE_CHAR_BUDGET,
    ProjectContextService,
)
from tests.conftest import FakeAsyncSession


def _project(
    *,
    name: str = "Ozymandias",
    instructions: str | None = None,
    sensitivity: str = "S1",
    description: str | None = None,
) -> Project:
    now = datetime.now(tz=UTC)
    return Project(
        project_id=uuid.uuid4(),
        user_id="user-1",
        name=name,
        description=description,
        instructions=instructions,
        sensitivity=sensitivity,
        status="active",
        priority="high",
        color="#58a6ff",
        start_date=None,
        target_date=None,
        completed_date=None,
        created_at=now,
        updated_at=now,
    )


def _task(
    project_id: uuid.UUID,
    *,
    name: str,
    status: str = "open",
    due_date: date | None = None,
) -> ProjectTask:
    now = datetime.now(tz=UTC)
    return ProjectTask(
        task_id=uuid.uuid4(),
        project_id=project_id,
        user_id="user-1",
        name=name,
        description=None,
        status=status,
        priority="medium",
        due_date=due_date,
        sort_order=0,
        created_at=now,
        updated_at=now,
    )


def _note(project_id: uuid.UUID, *, content: str) -> ProjectNote:
    return ProjectNote(
        note_id=uuid.uuid4(),
        project_id=project_id,
        user_id="user-1",
        content=content,
        source="user",
        created_at=datetime.now(tz=UTC),
    )


def _link(project_id: uuid.UUID, *, name: str, url: str) -> ProjectLink:
    return ProjectLink(
        link_id=uuid.uuid4(),
        project_id=project_id,
        user_id="user-1",
        name=name,
        url=url,
        created_at=datetime.now(tz=UTC),
    )


def _file(
    project_id: uuid.UUID,
    *,
    name: str,
    text: str | None,
    status: str = "ok",
) -> ProjectFile:
    return ProjectFile(
        file_id=uuid.uuid4(),
        project_id=project_id,
        user_id="user-1",
        filename=name,
        original_name=name,
        content_type="text/plain",
        size_bytes=len(text or ""),
        minio_bucket="ozy-files",
        minio_key=f"projects/p/{name}",
        extracted_text=text,
        extract_status=status,
        text_chars=len(text or ""),
        created_at=datetime.now(tz=UTC),
    )


def _service(
    *,
    project: Project,
    tasks: list[ProjectTask] | None = None,
    notes: list[ProjectNote] | None = None,
    links: list[ProjectLink] | None = None,
    files: list[ProjectFile] | None = None,
) -> ProjectContextService:
    service = ProjectContextService(cast(AsyncSession, FakeAsyncSession()))
    service.project_service.get_project = (  # type: ignore[method-assign]
        AsyncMock(return_value=project)
    )
    service.project_service.list_tasks = (  # type: ignore[method-assign]
        AsyncMock(return_value=tasks or [])
    )
    service.project_service.list_notes = (  # type: ignore[method-assign]
        AsyncMock(return_value=notes or [])
    )
    service.project_service.list_links = (  # type: ignore[method-assign]
        AsyncMock(return_value=links or [])
    )
    service.project_service.list_files = (  # type: ignore[method-assign]
        AsyncMock(return_value=files or [])
    )
    return service


@pytest.mark.asyncio
async def test_build_includes_instructions_and_open_work() -> None:
    project = _project(instructions="Always answer in bullet points.", description="A workspace.")
    service = _service(
        project=project,
        tasks=[
            _task(project.project_id, name="Write spec", due_date=date(2026, 6, 20)),
            _task(project.project_id, name="Ship it", status="done"),
        ],
        notes=[_note(project.project_id, content="Decided on Postgres.")],
        links=[_link(project.project_id, name="Repo", url="https://example.com")],
    )

    context = await service.build(
        user_id="user-1", project_id=str(project.project_id), query="what is left?"
    )

    assert '<workspace name="Ozymandias" sensitivity="S1">' in context.text
    assert "Always answer in bullet points." in context.text
    assert "A workspace." in context.text
    assert "Write spec" in context.text
    assert "due 2026-06-20" in context.text
    assert "Decided on Postgres." in context.text
    assert "Repo: https://example.com" in context.text
    # Finished work is not open work.
    assert "Ship it" not in context.text


@pytest.mark.asyncio
async def test_build_omits_empty_sections() -> None:
    project = _project()
    service = _service(project=project)

    context = await service.build(
        user_id="user-1", project_id=str(project.project_id), query="hello"
    )

    assert "<instructions>" not in context.text
    assert "<open_work" not in context.text
    assert "<knowledge" not in context.text
    assert context.knowledge_files == []
    assert context.knowledge_chars == 0


@pytest.mark.asyncio
async def test_small_knowledge_base_is_injected_whole() -> None:
    project = _project()
    service = _service(
        project=project,
        files=[
            _file(project.project_id, name="spec.md", text="The API returns JSON."),
            _file(project.project_id, name="notes.txt", text="Deploy on Fridays."),
        ],
    )

    context = await service.build(
        user_id="user-1", project_id=str(project.project_id), query="anything"
    )

    assert "The API returns JSON." in context.text
    assert "Deploy on Fridays." in context.text
    assert context.knowledge_files == ["notes.txt", "spec.md"]


@pytest.mark.asyncio
async def test_unreadable_files_never_become_knowledge() -> None:
    project = _project()
    service = _service(
        project=project,
        files=[
            _file(project.project_id, name="photo.png", text=None, status="unsupported"),
            _file(project.project_id, name="broken.pdf", text=None, status="failed"),
        ],
    )

    context = await service.build(
        user_id="user-1", project_id=str(project.project_id), query="anything"
    )

    assert "<knowledge" not in context.text
    assert context.knowledge_files == []


@pytest.mark.asyncio
async def test_large_knowledge_base_prefers_relevant_excerpts() -> None:
    project = _project()
    filler = "\n\n".join(f"Unrelated paragraph about gardening number {idx}." for idx in range(200))
    relevant = "The deployment pipeline runs on Kubernetes."
    service = _service(
        project=project,
        files=[_file(project.project_id, name="handbook.md", text=f"{filler}\n\n{relevant}")],
    )

    context = await service.build(
        user_id="user-1",
        project_id=str(project.project_id),
        query="How does the deployment pipeline work?",
    )

    assert relevant in context.text
    assert context.knowledge_chars <= KNOWLEDGE_CHAR_BUDGET


@pytest.mark.asyncio
async def test_knowledge_stays_within_budget() -> None:
    project = _project()
    huge = "\n\n".join(f"Paragraph {idx} " + "x" * 400 for idx in range(100))
    service = _service(
        project=project,
        files=[_file(project.project_id, name="huge.txt", text=huge)],
    )

    context = await service.build(
        user_id="user-1", project_id=str(project.project_id), query="paragraph"
    )

    assert context.knowledge_chars <= KNOWLEDGE_CHAR_BUDGET


@pytest.mark.parametrize(
    ("sensitivity", "expected"),
    [("S0", False), ("S1", False), ("S2", False), ("S3", True), ("S4", True)],
)
@pytest.mark.asyncio
async def test_sensitive_workspaces_force_local_routing(sensitivity: str, expected: bool) -> None:
    project = _project(sensitivity=sensitivity)
    service = _service(project=project)

    context = await service.build(
        user_id="user-1", project_id=str(project.project_id), query="hello"
    )

    assert context.force_local is expected
    assert context.sensitivity == sensitivity


@pytest.mark.asyncio
async def test_quotes_in_project_name_do_not_break_the_block() -> None:
    project = _project(name='The "Big" Project')
    service = _service(project=project)

    context = await service.build(
        user_id="user-1", project_id=str(project.project_id), query="hello"
    )

    assert "name=\"The 'Big' Project\"" in context.text
