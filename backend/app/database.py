"""Database engine and session management."""

import asyncio
from collections.abc import AsyncGenerator, Coroutine
from typing import Any

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.sql import text

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    future=True,
    pool_pre_ping=True,
)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
    class_=AsyncSession,
)


async def get_db() -> AsyncGenerator[AsyncSession]:
    """Yield one async database session per request."""
    async with AsyncSessionLocal() as session:
        yield session


async def get_redis() -> AsyncGenerator[Redis]:
    """Yield one Redis client per request."""
    client = Redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
    try:
        yield client
    finally:
        await client.aclose()


async def init_db() -> None:
    """Run a lightweight database connectivity check."""
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


def run_db_job[T](work: Coroutine[Any, Any, T]) -> T:
    """Run a coroutine from synchronous code and leave no pooled connections.

    Celery gives every task its own event loop. Connections the pool kept from
    an earlier task belong to a loop that is already closed, and reusing one
    fails with "attached to a different loop", so the pool is emptied at the
    end of each run.
    """

    async def _runner() -> T:
        try:
            return await work
        finally:
            await engine.dispose()

    return asyncio.run(_runner())
