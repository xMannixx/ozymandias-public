"""Celery application and beat schedule for background jobs.

Started by the ``worker`` service in ``docker-compose.yaml``. Redis is both
broker and result backend, the same instance the circuit breaker uses; the key
prefixes do not collide.
"""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "ozymandias",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.services.decay_service",
        "app.services.memory_lifecycle_service",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # A decay run touches every claim of a user, so give it room, but never
    # let a stuck job hold the worker overnight.
    task_time_limit=30 * 60,
    task_soft_time_limit=25 * 60,
    task_acks_late=True,
    worker_max_tasks_per_child=100,
    result_expires=24 * 60 * 60,
)

celery_app.conf.beat_schedule = {
    "decay-all-users": {
        "task": "ozy.decay.run_all",
        "schedule": crontab(hour="3", minute="0"),
    },
    # Half an hour later, so the two jobs never write the same claims at once.
    "memory-cleanup-all-users": {
        "task": "ozy.memory.cleanup_all",
        "schedule": crontab(hour="3", minute="30"),
    },
}
