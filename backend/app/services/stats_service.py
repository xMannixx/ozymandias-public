"""Dashboard statistics aggregation service."""

from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from dataclasses import dataclass
from typing import cast

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.claim import Claim
from app.models.contact import Contact
from app.models.project import Project, ProjectMilestone, ProjectRisk, ProjectTask
from app.models.proposal import MemoryProposal
from app.schemas import AuditEventType, VerificationState
from app.schemas.api_models import (
    AuditEntryResponse,
    CircuitBreakerStatusResponse,
    DashboardStats,
)
from app.services.audit_service import AuditService
from app.services.circuit_breaker_service import CircuitBreakerService
from app.services.utils import normalize_user_id


@dataclass(frozen=True)
class _DbMetrics:
    claims_total: int
    claims_by_verification: dict[str, int]
    claims_by_sensitivity: dict[str, int]
    proposals_pending: int
    proposals_total: int
    recent_actions: list[AuditEntryResponse]
    provider_usage: dict[str, int]
    projects_active: int
    projects_tasks_open: int
    projects_risks_critical: int
    projects_next_milestone: str | None
    contacts_total: int


class StatsService:
    """Aggregate dashboard metrics from claims, proposals, audit, and circuit breaker state."""

    def __init__(self, db: AsyncSession, redis: Redis) -> None:
        self.db = db
        self.redis = redis

    async def get_dashboard_stats(self, user_id: str) -> DashboardStats:
        """Return all dashboard metrics for one user."""
        normalized_user_id = normalize_user_id(user_id)
        db_metrics, circuit_breaker = await asyncio.gather(
            self._collect_db_metrics(user_id=user_id, normalized_user_id=normalized_user_id),
            self._get_circuit_breaker(user_id=user_id),
        )
        return DashboardStats(
            claims_total=db_metrics.claims_total,
            claims_by_verification=db_metrics.claims_by_verification,
            claims_by_sensitivity=db_metrics.claims_by_sensitivity,
            proposals_pending=db_metrics.proposals_pending,
            proposals_total=db_metrics.proposals_total,
            circuit_breaker=circuit_breaker,
            recent_actions=db_metrics.recent_actions,
            provider_usage=db_metrics.provider_usage,
            projects_active=db_metrics.projects_active,
            projects_tasks_open=db_metrics.projects_tasks_open,
            projects_risks_critical=db_metrics.projects_risks_critical,
            projects_next_milestone=db_metrics.projects_next_milestone,
            contacts_total=db_metrics.contacts_total,
        )

    async def _collect_db_metrics(
        self,
        *,
        user_id: str,
        normalized_user_id: uuid.UUID,
    ) -> _DbMetrics:
        claims_total = await self._claims_total(normalized_user_id=normalized_user_id)
        claims_by_verification = await self._claims_by_verification(
            normalized_user_id=normalized_user_id
        )
        claims_by_sensitivity = await self._claims_by_sensitivity(
            normalized_user_id=normalized_user_id
        )
        proposals_pending, proposals_total = await self._proposal_counts(
            normalized_user_id=normalized_user_id
        )
        recent_actions = await self._recent_actions(user_id=user_id)
        provider_usage = await self._provider_usage(normalized_user_id=normalized_user_id)
        (
            projects_active,
            projects_tasks_open,
            projects_risks_critical,
            projects_next_milestone,
        ) = await self._project_metrics(user_id=user_id)
        contacts_total = await self._contacts_total(user_id=user_id)
        return _DbMetrics(
            claims_total=claims_total,
            claims_by_verification=claims_by_verification,
            claims_by_sensitivity=claims_by_sensitivity,
            proposals_pending=proposals_pending,
            proposals_total=proposals_total,
            recent_actions=recent_actions,
            provider_usage=provider_usage,
            projects_active=projects_active,
            projects_tasks_open=projects_tasks_open,
            projects_risks_critical=projects_risks_critical,
            projects_next_milestone=projects_next_milestone,
            contacts_total=contacts_total,
        )

    async def _claims_total(self, *, normalized_user_id: uuid.UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(Claim)
            .where(
                Claim.user_id == normalized_user_id,
                Claim.verification_state != VerificationState.retracted.value,
            )
        )
        result = await self.db.execute(stmt)
        total_raw = result.scalar_one_or_none()
        return int(total_raw) if total_raw is not None else 0

    async def _claims_by_verification(self, *, normalized_user_id: uuid.UUID) -> dict[str, int]:
        stmt = (
            select(Claim.verification_state, func.count())
            .where(Claim.user_id == normalized_user_id)
            .group_by(Claim.verification_state)
        )
        result = await self.db.execute(stmt)
        rows = result.all()
        return {str(state): int(count) for state, count in rows}

    async def _claims_by_sensitivity(self, *, normalized_user_id: uuid.UUID) -> dict[str, int]:
        stmt = (
            select(Claim.sensitivity, func.count())
            .where(Claim.user_id == normalized_user_id)
            .group_by(Claim.sensitivity)
        )
        result = await self.db.execute(stmt)
        rows = result.all()
        return {str(sensitivity): int(count) for sensitivity, count in rows}

    async def _proposal_counts(self, *, normalized_user_id: uuid.UUID) -> tuple[int, int]:
        pending_stmt = (
            select(func.count())
            .select_from(MemoryProposal)
            .where(
                MemoryProposal.user_id == normalized_user_id,
                MemoryProposal.status == "pending",
            )
        )
        pending_result = await self.db.execute(pending_stmt)
        pending_raw = pending_result.scalar_one_or_none()

        total_stmt = (
            select(func.count())
            .select_from(MemoryProposal)
            .where(MemoryProposal.user_id == normalized_user_id)
        )
        total_result = await self.db.execute(total_stmt)
        total_raw = total_result.scalar_one_or_none()
        return (
            int(pending_raw) if pending_raw is not None else 0,
            int(total_raw) if total_raw is not None else 0,
        )

    async def _recent_actions(self, *, user_id: str) -> list[AuditEntryResponse]:
        audit_service = AuditService(self.db)
        entries, _total = await audit_service.list_entries(
            user_id=user_id,
            event_type=None,
            sensitivity=None,
            result=None,
            after=None,
            before=None,
            limit=10,
            offset=0,
            exclude_s4=True,
        )
        return [
            AuditEntryResponse(
                audit_id=str(entry.audit_id),
                event_type=entry.event_type,
                user_id=str(entry.user_id),
                channel=entry.channel,
                payload=entry.payload,
                source_ref=entry.source_ref,
                result=entry.result,
                sensitivity=entry.sensitivity,
                created_at=entry.created_at,
            )
            for entry in entries
        ]

    async def _provider_usage(self, *, normalized_user_id: uuid.UUID) -> dict[str, int]:
        stmt = select(AuditLog.payload).where(
            AuditLog.user_id == normalized_user_id,
            AuditLog.event_type == AuditEventType.turn_processed.value,
        )
        result = await self.db.execute(stmt)
        payloads = list(result.scalars().all())
        counts: defaultdict[str, int] = defaultdict(int)
        for payload in payloads:
            payload_dict = cast(dict[str, object] | None, payload)
            if payload_dict is None:
                continue
            provider_raw = payload_dict.get("provider")
            if not isinstance(provider_raw, str) or not provider_raw:
                continue
            counts[provider_raw] += 1
        return dict(counts)

    async def _get_circuit_breaker(self, *, user_id: str) -> CircuitBreakerStatusResponse:
        breaker = CircuitBreakerService(self.db, redis_client=self.redis)
        state = await breaker.get_state(user_id=user_id, action_type="turn_process")
        return CircuitBreakerStatusResponse(
            current_count=state.current_count,
            is_tripped=state.is_tripped,
            max_actions=int(breaker.config.max_actions_per_window),
            window_seconds=int(breaker.config.window_seconds),
            cooldown_seconds=int(breaker.config.cooldown_seconds),
        )

    async def _contacts_total(self, *, user_id: str) -> int:
        stmt = select(func.count()).select_from(Contact).where(Contact.user_id == user_id)
        result = await self.db.execute(stmt)
        raw = result.scalar_one_or_none()
        return int(raw) if raw is not None else 0

    async def _project_metrics(self, *, user_id: str) -> tuple[int, int, int, str | None]:
        active_stmt = (
            select(func.count())
            .select_from(Project)
            .where(
                Project.user_id == user_id,
                Project.status == "active",
            )
        )
        active_result = await self.db.execute(active_stmt)
        active_raw = active_result.scalar_one_or_none()
        projects_active = int(active_raw) if active_raw is not None else 0

        tasks_stmt = (
            select(func.count())
            .select_from(ProjectTask)
            .where(
                ProjectTask.user_id == user_id,
                ProjectTask.status.in_(("open", "in_progress")),
            )
        )
        tasks_result = await self.db.execute(tasks_stmt)
        tasks_raw = tasks_result.scalar_one_or_none()
        projects_tasks_open = int(tasks_raw) if tasks_raw is not None else 0

        risks_stmt = (
            select(func.count())
            .select_from(ProjectRisk)
            .where(
                ProjectRisk.user_id == user_id,
                ProjectRisk.severity == "critical",
                ProjectRisk.status == "open",
            )
        )
        risks_result = await self.db.execute(risks_stmt)
        risks_raw = risks_result.scalar_one_or_none()
        projects_risks_critical = int(risks_raw) if risks_raw is not None else 0

        next_milestone_stmt = (
            select(ProjectMilestone.name, ProjectMilestone.due_date)
            .join(Project, Project.project_id == ProjectMilestone.project_id)
            .where(
                Project.user_id == user_id,
                Project.status == "active",
                ProjectMilestone.completed.is_(False),
                ProjectMilestone.due_date.is_not(None),
            )
            .order_by(ProjectMilestone.due_date.asc())
            .limit(1)
        )
        next_milestone_result = await self.db.execute(next_milestone_stmt)
        next_milestone_row = next_milestone_result.first()
        if next_milestone_row is None:
            projects_next_milestone = None
        else:
            name, due_date = next_milestone_row
            projects_next_milestone = f"{name} ({due_date.isoformat()})"

        return (
            projects_active,
            projects_tasks_open,
            projects_risks_critical,
            projects_next_milestone,
        )
