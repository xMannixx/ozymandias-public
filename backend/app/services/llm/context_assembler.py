"""Assemble user context from DB entities for turn prompts."""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.claim import Claim
from app.models.contact import Contact
from app.models.project import Project, ProjectTask
from app.schemas import Sensitivity
from app.schemas.token_budget import TokenBudgetRequest
from app.services.claim_service import ClaimService
from app.services.contact_service import ContactService
from app.services.memory_recall_service import MemoryRecallService
from app.services.project_service import ProjectService
from app.services.rust_bridge import OzyRustError, allocate_token_budget

_log = logging.getLogger(__name__)
_CHAR_LIMIT = 6000
_MAX_CLAIMS = 50
_MAX_CONTACTS = 30


class ContextAssembler:
    """Build a compact, model-friendly context block from user data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.claim_service = ClaimService(db)
        self.project_service = ProjectService(db)
        self.contact_service = ContactService(db)
        self.recall_service = MemoryRecallService(db)

    async def assemble_query_aware(
        self,
        *,
        user_id: str,
        query: str,
        provider_is_local: bool,
        per_lane_char_budget: int = 1200,
    ) -> str:
        """Query-aware recall block driven by the current user message.

        Identity floor is always present, other lanes compete for a per-lane
        budget based on relevance to ``query``. Returns an empty string when no
        memory is relevant so callers can omit the block entirely.
        """
        result = await self.recall_service.recall(
            user_id=user_id,
            query=query,
            provider_is_local=provider_is_local,
            per_lane_char_budget=per_lane_char_budget,
        )
        return result.text

    async def assemble(
        self,
        *,
        user_id: str,
        sensitivity: Sensitivity,
        provider_is_local: bool,
        intent: str = "general_turn",
        include_projects: bool = True,
    ) -> str:
        """Fetch and format user context, with size-aware fallback compaction.

        ``include_projects=False`` omits the project overview, for turns where a
        single workspace is already rendered in depth elsewhere.
        """
        del sensitivity  # Reserved for future relevance/scope filtering.

        claims = await self.claim_service.list_claims(user_id=user_id)
        if not provider_is_local:
            claims = [
                claim
                for claim in claims
                if claim.sensitivity not in {Sensitivity.S3.value, Sensitivity.S4.value}
            ]

        # Determine max_claims via Rust token budget allocator.
        max_claims = _MAX_CLAIMS
        if claims:
            try:
                settings = get_settings()
                budget = allocate_token_budget(
                    TokenBudgetRequest(
                        available_tokens=settings.context_token_budget,
                        claims_count=len(claims),
                        intent_type=intent,
                    )
                )
                max_claims = min(_MAX_CLAIMS, int(budget.max_claims))
            except OzyRustError as exc:
                _log.warning("token_budget allocation failed, using default: %s", exc)

        claims = claims[:max_claims]

        projects: list[Project] = []
        tasks_by_project: dict[str, list[ProjectTask]] = {}
        if include_projects:
            projects = await self.project_service.list_projects(user_id, status="active")
            for project in projects:
                project_tasks = await self.project_service.list_tasks(
                    str(project.project_id), user_id
                )
                tasks_by_project[str(project.project_id)] = project_tasks

        contacts = await self.contact_service.list_contacts(user_id)
        contacts = contacts[:_MAX_CONTACTS]

        context = self._render_context(
            claims=claims,
            projects=projects,
            contacts=contacts,
            tasks_by_project=tasks_by_project,
            compact_projects=False,
            compact_contacts=False,
        )
        if len(context) <= _CHAR_LIMIT:
            return context

        prioritized_claims = self._prioritize_claims(claims)
        compact_claims = prioritized_claims[:]
        compact_contacts = contacts[:]
        compact_projects = projects[:]
        compact_context = self._render_context(
            claims=compact_claims,
            projects=compact_projects,
            contacts=compact_contacts,
            tasks_by_project={},
            compact_projects=True,
            compact_contacts=True,
        )
        while len(compact_context) > _CHAR_LIMIT and compact_contacts:
            compact_contacts.pop()
            compact_context = self._render_context(
                claims=compact_claims,
                projects=compact_projects,
                contacts=compact_contacts,
                tasks_by_project={},
                compact_projects=True,
                compact_contacts=True,
            )
        while len(compact_context) > _CHAR_LIMIT and compact_claims:
            compact_claims.pop()
            compact_context = self._render_context(
                claims=compact_claims,
                projects=compact_projects,
                contacts=compact_contacts,
                tasks_by_project={},
                compact_projects=True,
                compact_contacts=True,
            )
        while len(compact_context) > _CHAR_LIMIT and compact_projects:
            compact_projects.pop()
            compact_context = self._render_context(
                claims=compact_claims,
                projects=compact_projects,
                contacts=compact_contacts,
                tasks_by_project={},
                compact_projects=True,
                compact_contacts=True,
            )

        if len(compact_context) > _CHAR_LIMIT:
            return self._render_empty_context()
        return compact_context

    def _prioritize_claims(self, claims: list[Claim]) -> list[Claim]:
        sorted_claims = sorted(
            claims,
            key=lambda claim: (
                claim.verification_state != "confirmed",
                not claim.user_locked,
                -claim.confidence,
            ),
        )
        return sorted_claims[:_MAX_CLAIMS]

    def _render_context(
        self,
        *,
        claims: list[Claim],
        projects: list[Project],
        contacts: list[Contact],
        tasks_by_project: dict[str, list[ProjectTask]],
        compact_projects: bool,
        compact_contacts: bool,
    ) -> str:
        if not claims and not projects and not contacts:
            return self._render_empty_context()

        lines = ["<user_context>", ""]

        lines.append(f'<claims count="{len(claims)}">')
        for claim in claims:
            meta = f"{claim.memory_type}, {claim.verification_state}, {claim.sensitivity}"
            lines.append(f"- {claim.content} [{meta}]")
        lines.append("</claims>")
        lines.append("")

        lines.append(f'<projects count="{len(projects)}">')
        for project in projects:
            lines.append(self._render_project_line(project, compact=compact_projects))
            if compact_projects:
                continue
            project_tasks = tasks_by_project.get(str(project.project_id), [])
            done_count = sum(1 for task in project_tasks if task.status == "done")
            if project_tasks:
                task_summary = ", ".join(f"{task.name} ({task.status})" for task in project_tasks)
            else:
                task_summary = "none"
            lines.append(f"  Tasks ({done_count}/{len(project_tasks)} done): {task_summary}")
        lines.append("</projects>")
        lines.append("")

        lines.append(f'<contacts count="{len(contacts)}">')
        for contact in contacts:
            lines.append(self._render_contact_line(contact, compact=compact_contacts))
        lines.append("</contacts>")
        lines.append("")
        lines.append("</user_context>")
        return "\n".join(lines)

    @staticmethod
    def _render_empty_context() -> str:
        return (
            "<user_context>\n"
            "No claims, projects or contacts stored yet. Memory is empty.\n"
            "</user_context>"
        )

    @staticmethod
    def _person_name(contact: Contact) -> str:
        if contact.last_name:
            return f"{contact.first_name} {contact.last_name}"
        return contact.first_name

    def _render_contact_line(self, contact: Contact, *, compact: bool) -> str:
        name = self._person_name(contact)
        if compact:
            if contact.company:
                return f"- {name} ({contact.company})"
            return f"- {name}"
        details = [entry for entry in (contact.company, contact.role) if entry]
        if details:
            return f"- {name} ({', '.join(details)})"
        return f"- {name}"

    def _render_project_line(self, project: Project, *, compact: bool) -> str:
        if compact:
            return f"Project: {project.name} | Status: {project.status}"
        line = f"Project: {project.name} | Status: {project.status} | Priority: {project.priority}"
        if project.start_date or project.target_date:
            start = self._format_date(project.start_date) if project.start_date else "?"
            end = self._format_date(project.target_date) if project.target_date else "?"
            line += f" | {start}–{end}"
        return line

    @staticmethod
    def _format_date(value: date) -> str:
        return f"{value.day}.{value.month}.{value.year}"
