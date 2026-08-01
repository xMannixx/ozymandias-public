"""Tests for context assembly before LLM routing."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim
from app.models.contact import Contact
from app.models.project import Project, ProjectTask
from app.schemas import Sensitivity
from app.services.llm.context_assembler import ContextAssembler
from tests.conftest import FakeAsyncSession


def _claim(
    *,
    content: str,
    sensitivity: str = "S0",
    verification_state: str = "tentative",
    confidence: float = 0.5,
    user_locked: bool = False,
) -> Claim:
    now = datetime.now(tz=UTC)
    return Claim(
        claim_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        subject="user:1",
        attribute="about",
        value=content,
        content=content,
        memory_type="profile",
        verification_state=verification_state,
        confidence=confidence,
        source_ref="turn-1",
        source_type="user_explicit",
        sensitivity=sensitivity,
        trust_level="T3",
        handling_policy="local_preferred",
        user_locked=user_locked,
        decay_eligible=True,
        lifecycle="temporary",
        valid_from=None,
        valid_to=None,
        ingested_at=now,
        superseded_at=None,
        review_due=False,
        last_reviewed=None,
        last_accessed=None,
        created_at=now,
        updated_at=now,
    )


def _project(
    *,
    name: str = "Ozymandias",
    start_date: date | None = date(2026, 4, 6),
    target_date: date | None = date(2026, 4, 12),
) -> Project:
    now = datetime.now(tz=UTC)
    return Project(
        project_id=uuid.uuid4(),
        user_id="user-1",
        name=name,
        description="desc",
        status="active",
        priority="high",
        color="#58a6ff",
        start_date=start_date,
        target_date=target_date,
        completed_date=None,
        created_at=now,
        updated_at=now,
    )


def _task(*, project_id: uuid.UUID, name: str, status: str) -> ProjectTask:
    now = datetime.now(tz=UTC)
    return ProjectTask(
        task_id=uuid.uuid4(),
        project_id=project_id,
        user_id="user-1",
        name=name,
        description=None,
        status=status,
        priority="medium",
        due_date=None,
        sort_order=0,
        created_at=now,
        updated_at=now,
    )


def _contact(
    *,
    first_name: str = "Max",
    last_name: str | None = "Mustermann",
    company: str | None = "Firma GmbH",
    role: str | None = "Developer",
) -> Contact:
    now = datetime.now(tz=UTC)
    return Contact(
        contact_id=uuid.uuid4(),
        user_id="user-1",
        first_name=first_name,
        last_name=last_name,
        company=company,
        role=role,
        phones=[],
        emails=[],
        address=None,
        birthday=None,
        notes=None,
        tags=[],
        avatar_minio_key=None,
        created_at=now,
        updated_at=now,
    )


def _assembler() -> ContextAssembler:
    return ContextAssembler(cast(AsyncSession, FakeAsyncSession()))


def _patch_services(
    assembler: ContextAssembler,
    *,
    claims: list[Claim],
    projects: list[Project],
    tasks: list[ProjectTask],
    contacts: list[Contact],
) -> None:
    assembler.claim_service.list_claims = (  # type: ignore[method-assign]
        AsyncMock(return_value=claims)
    )
    assembler.project_service.list_projects = (  # type: ignore[method-assign]
        AsyncMock(return_value=projects)
    )
    assembler.project_service.list_tasks = (  # type: ignore[method-assign]
        AsyncMock(return_value=tasks)
    )
    assembler.contact_service.list_contacts = (  # type: ignore[method-assign]
        AsyncMock(return_value=contacts)
    )


@pytest.mark.asyncio
async def test_context_assembler_returns_empty_context_when_no_data() -> None:
    assembler = _assembler()
    _patch_services(assembler, claims=[], projects=[], tasks=[], contacts=[])

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S1,
        provider_is_local=False,
    )
    assert "Memory is empty" in output
    assert output.startswith("<user_context>")


@pytest.mark.asyncio
async def test_context_assembler_formats_claims_projects_and_contacts() -> None:
    assembler = _assembler()
    project = _project(name="Ozymandias")
    _patch_services(
        assembler,
        claims=[_claim(content="Alex wohnt in Beispielstadt")],
        projects=[project],
        tasks=[_task(project_id=project.project_id, name="Task A", status="done")],
        contacts=[_contact(first_name="Lisa", last_name="Schmidt", company=None, role=None)],
    )

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S1,
        provider_is_local=True,
    )
    assert '<claims count="1">' in output
    assert '<projects count="1">' in output
    assert '<contacts count="1">' in output
    assert "Alex wohnt in Beispielstadt" in output
    assert "Project: Ozymandias" in output
    assert "Task A (done)" in output
    assembler.project_service.list_tasks.assert_awaited_once_with(  # type: ignore[attr-defined]
        str(project.project_id), "user-1"
    )


@pytest.mark.asyncio
async def test_context_assembler_omits_projects_when_a_workspace_is_active() -> None:
    assembler = _assembler()
    project = _project(name="Ozymandias")
    _patch_services(
        assembler,
        claims=[_claim(content="Alex wohnt in Beispielstadt")],
        projects=[project],
        tasks=[_task(project_id=project.project_id, name="Task A", status="open")],
        contacts=[],
    )

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S1,
        provider_is_local=True,
        include_projects=False,
    )
    assert '<projects count="0">' in output
    assert "Ozymandias" not in output
    assert "Alex wohnt in Beispielstadt" in output
    assembler.project_service.list_projects.assert_not_awaited()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_context_assembler_filters_s3_claims_for_cloud_provider() -> None:
    assembler = _assembler()
    _patch_services(
        assembler,
        claims=[
            _claim(content="S3 geheim", sensitivity="S3"),
            _claim(content="S1 oeffentlich", sensitivity="S1"),
        ],
        projects=[],
        tasks=[],
        contacts=[],
    )

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S3,
        provider_is_local=False,
    )
    assert "S3 geheim" not in output
    assert "S1 oeffentlich" in output


@pytest.mark.asyncio
async def test_context_assembler_keeps_s3_claims_for_local_provider() -> None:
    assembler = _assembler()
    _patch_services(
        assembler,
        claims=[_claim(content="S3 lokal", sensitivity="S3")],
        projects=[],
        tasks=[],
        contacts=[],
    )

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S3,
        provider_is_local=True,
    )
    assert "S3 lokal" in output


@pytest.mark.asyncio
async def test_context_assembler_limits_claim_count_to_50() -> None:
    assembler = _assembler()
    claims = [_claim(content=f"Claim {idx}") for idx in range(60)]
    _patch_services(assembler, claims=claims, projects=[], tasks=[], contacts=[])

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S1,
        provider_is_local=True,
    )
    assert '<claims count="50">' in output
    assert "Claim 49" in output
    assert "Claim 50" not in output


@pytest.mark.asyncio
async def test_context_assembler_compacts_when_output_exceeds_char_limit() -> None:
    assembler = _assembler()
    long_claims = [_claim(content=f"Claim-{idx}-" + ("x" * 300)) for idx in range(50)]
    projects = [_project(name=f"Projekt {idx}") for idx in range(10)]
    tasks = [
        _task(project_id=projects[0].project_id, name=f"Task {idx}", status="open")
        for idx in range(20)
    ]
    contacts = [_contact(first_name=f"Kontakt{idx}", company="C" * 300) for idx in range(30)]
    _patch_services(
        assembler,
        claims=long_claims,
        projects=projects,
        tasks=tasks,
        contacts=contacts,
    )

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S1,
        provider_is_local=True,
    )
    assert len(output) <= 6000
    assert output.startswith("<user_context>")


@pytest.mark.asyncio
async def test_context_assembler_sorts_claims_by_priority_on_compaction() -> None:
    assembler = _assembler()
    claims = [
        _claim(content="tentative-high", verification_state="tentative", confidence=0.95),
        _claim(content="confirmed-low", verification_state="confirmed", confidence=0.10),
        _claim(
            content="tentative-locked",
            verification_state="tentative",
            confidence=0.20,
            user_locked=True,
        ),
    ]
    contacts = [_contact(first_name=f"Kontakt{idx}", company="Y" * 500) for idx in range(30)]
    _patch_services(
        assembler,
        claims=claims,
        projects=[],
        tasks=[],
        contacts=contacts,
    )

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S1,
        provider_is_local=True,
    )
    idx_confirmed = output.find("confirmed-low")
    idx_locked = output.find("tentative-locked")
    idx_tentative = output.find("tentative-high")
    assert idx_confirmed != -1
    assert idx_locked != -1
    assert idx_tentative != -1
    assert idx_confirmed < idx_locked < idx_tentative


@pytest.mark.asyncio
async def test_context_assembler_renders_contact_without_last_name() -> None:
    assembler = _assembler()
    _patch_services(
        assembler,
        claims=[],
        projects=[],
        tasks=[],
        contacts=[_contact(first_name="Lisa", last_name=None, company=None, role=None)],
    )

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S1,
        provider_is_local=True,
    )
    assert "- Lisa" in output
    assert "Lisa None" not in output


@pytest.mark.asyncio
async def test_context_assembler_renders_project_without_date_range() -> None:
    assembler = _assembler()
    _patch_services(
        assembler,
        claims=[],
        projects=[_project(name="OhneDatum", start_date=None, target_date=None)],
        tasks=[],
        contacts=[],
    )

    output = await assembler.assemble(
        user_id="user-1",
        sensitivity=Sensitivity.S1,
        provider_is_local=True,
    )
    assert "Project: OhneDatum | Status: active | Priority: high" in output
    assert "?" not in output
