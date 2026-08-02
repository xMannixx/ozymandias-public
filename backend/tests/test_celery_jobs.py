"""Tests for the Celery app and the beat entrypoints that fan out over users."""

from __future__ import annotations

import uuid
from types import TracebackType
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app import database
from app.celery_app import celery_app
from app.services import decay_service, memory_lifecycle_service
from app.services.job_targets import user_ids_with_claims
from tests.conftest import FakeAsyncSession, FakeQueryResult


class _FakeSessionFactory:
    """Stand-in for ``AsyncSessionLocal`` that hands out one prepared session."""

    def __init__(self, session: FakeAsyncSession) -> None:
        self.session = session

    def __call__(self) -> _FakeSessionFactory:
        return self

    async def __aenter__(self) -> FakeAsyncSession:
        return self.session

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> bool:
        return False


def _session_with_users(*user_ids: uuid.UUID) -> FakeAsyncSession:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=list(user_ids)))
    return db


@pytest.mark.asyncio
async def test_user_ids_with_claims_returns_strings() -> None:
    first, second = uuid.uuid4(), uuid.uuid4()
    db = _session_with_users(first, second)

    user_ids = await user_ids_with_claims(cast(AsyncSession, db))

    assert user_ids == [str(first), str(second)]


@pytest.mark.asyncio
async def test_no_claims_means_no_job_targets() -> None:
    db = FakeAsyncSession()
    db.queue_execute_result(FakeQueryResult(values=[]))

    assert await user_ids_with_claims(cast(AsyncSession, db)) == []


@pytest.mark.asyncio
async def test_decay_beat_job_runs_for_every_user(monkeypatch: pytest.MonkeyPatch) -> None:
    """Beat has no user to pass in, so the job has to find them itself."""
    first, second = uuid.uuid4(), uuid.uuid4()
    monkeypatch.setattr(
        decay_service,
        "AsyncSessionLocal",
        _FakeSessionFactory(_session_with_users(first, second)),
    )
    seen: list[str] = []

    async def _fake_job(user_id: str) -> dict[str, int]:
        seen.append(user_id)
        return {"keep": 1, "reduce_confidence": 0, "expire": 0, "archive": 0}

    monkeypatch.setattr(decay_service, "_run_decay_job", _fake_job)

    result = await decay_service._run_decay_job_for_all()

    assert seen == [str(first), str(second)]
    assert result[str(first)]["keep"] == 1
    assert set(result) == {str(first), str(second)}


@pytest.mark.asyncio
async def test_memory_cleanup_beat_job_runs_for_every_user(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = uuid.uuid4()
    monkeypatch.setattr(
        memory_lifecycle_service,
        "AsyncSessionLocal",
        _FakeSessionFactory(_session_with_users(user_id)),
    )
    seen: list[str] = []

    async def _fake_job(target: str) -> dict[str, int]:
        seen.append(target)
        return {"snippets": 2}

    monkeypatch.setattr(memory_lifecycle_service, "_run_memory_cleanup_job", _fake_job)

    result = await memory_lifecycle_service._run_memory_cleanup_job_for_all()

    assert seen == [str(user_id)]
    assert result == {str(user_id): {"snippets": 2}}


def test_run_db_job_drops_pooled_connections_after_every_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Each Celery task gets a new loop; connections from the last one are dead."""
    disposals = 0

    class _FakeEngine:
        async def dispose(self) -> None:
            nonlocal disposals
            disposals += 1

    monkeypatch.setattr(database, "engine", _FakeEngine())

    async def _work(value: int) -> int:
        return value * 2

    assert database.run_db_job(_work(2)) == 4
    assert database.run_db_job(_work(3)) == 6
    assert disposals == 2


def test_run_db_job_disposes_even_when_the_job_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    disposed = False

    class _FakeEngine:
        async def dispose(self) -> None:
            nonlocal disposed
            disposed = True

    monkeypatch.setattr(database, "engine", _FakeEngine())

    async def _boom() -> None:
        raise RuntimeError("job failed")

    with pytest.raises(RuntimeError):
        database.run_db_job(_boom())

    assert disposed


def test_celery_app_knows_all_maintenance_tasks() -> None:
    registered = set(celery_app.tasks)

    assert {
        "ozy.decay.run",
        "ozy.decay.run_all",
        "ozy.memory.cleanup",
        "ozy.memory.cleanup_all",
    } <= registered


def test_worker_imports_the_modules_that_define_the_tasks() -> None:
    """Without these on the include list a started worker registers nothing."""
    assert set(celery_app.conf.include) == {
        "app.services.decay_service",
        "app.services.memory_lifecycle_service",
    }


def test_beat_schedule_only_points_at_tasks_that_exist() -> None:
    """A typo here would mean the nightly job silently never runs."""
    scheduled = {entry["task"] for entry in celery_app.conf.beat_schedule.values()}

    assert scheduled
    assert scheduled <= set(celery_app.tasks)


def test_worker_talks_to_redis() -> None:
    assert str(celery_app.conf.broker_url).startswith("redis://")
    assert str(celery_app.conf.result_backend).startswith("redis://")
