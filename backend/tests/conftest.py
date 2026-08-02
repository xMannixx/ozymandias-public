"""Pytest fixtures."""

from collections.abc import AsyncIterator
from typing import Any, cast
from unittest.mock import AsyncMock

import fakeredis.aioredis
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import get_current_user
from app.database import get_db, get_redis
from app.main import create_app


def await_kwargs(mock: object) -> dict[str, Any]:
    """Keyword arguments of a mock's last await.

    Patched methods keep their declared type, so reaching for ``await_args``
    directly upsets the type checker at every call site.
    """
    await_args = cast(AsyncMock, mock).await_args
    assert await_args is not None, "expected the mock to have been awaited"
    return dict(await_args.kwargs)


class FakeScalarResult:
    """Simple scalar wrapper used by FakeQueryResult."""

    def __init__(self, values: list[object]) -> None:
        self._values = values

    def all(self) -> list[object]:
        return self._values


class FakeQueryResult:
    """Simple execute result wrapper for test doubles."""

    def __init__(self, values: list[object] | None = None, single: object | None = None) -> None:
        self._values = values if values is not None else ([] if single is None else [single])
        self._single = single if single is not None else (self._values[0] if self._values else None)

    def scalars(self) -> FakeScalarResult:
        return FakeScalarResult(self._values)

    def scalar_one_or_none(self) -> object | None:
        return self._single

    def first(self) -> object | None:
        return self._single

    def all(self) -> list[object]:
        return self._values


class FakeAsyncSession:
    """Minimal async session used in API tests."""

    def __init__(self) -> None:
        self._execute_results: list[FakeQueryResult] = []
        self.added: list[object] = []
        self.deleted: list[object] = []
        self.commits = 0
        self.refreshes = 0
        self.rollbacks = 0

    def queue_execute_result(self, result: FakeQueryResult) -> None:
        self._execute_results.append(result)

    async def execute(self, _query: object) -> FakeQueryResult:
        if self._execute_results:
            return self._execute_results.pop(0)
        return FakeQueryResult(values=[])

    def add(self, value: object) -> None:
        self.added.append(value)

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        self.rollbacks += 1

    async def refresh(self, _obj: object) -> None:
        self.refreshes += 1

    async def delete(self, value: object) -> None:
        self.deleted.append(value)


async def fake_get_db() -> AsyncIterator[FakeAsyncSession]:
    """Override `get_db` dependency for tests."""
    yield FakeAsyncSession()


async def fake_get_redis() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
    """Override `get_redis` dependency for tests."""
    redis_client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield redis_client
    finally:
        await redis_client.aclose()


def fake_get_current_user() -> str:
    """Default auth dependency override for test client."""
    return "test-user-id"


@pytest.fixture()
def app() -> FastAPI:
    test_app = create_app()
    test_app.dependency_overrides[get_db] = fake_get_db
    test_app.dependency_overrides[get_redis] = fake_get_redis
    test_app.dependency_overrides[get_current_user] = fake_get_current_user
    return test_app


@pytest_asyncio.fixture()
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


@pytest.fixture()
def fake_query_result() -> type[FakeQueryResult]:
    return FakeQueryResult
