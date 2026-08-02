"""Assemble user context from DB entities for turn prompts."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
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
from app.services.episode_recall_service import EpisodeRecallService, RecalledEpisode
from app.services.llm.contact_match import ContactMatch, match_contacts
from app.services.memory_recall_service import MemoryRecallService
from app.services.project_service import ProjectService
from app.services.rust_bridge import OzyRustError, allocate_token_budget

_log = logging.getLogger(__name__)
_CHAR_LIMIT = 6000
_MAX_CLAIMS = 50
_MAX_CONTACTS = 30
#: Long notes would eat the budget a full entry is worth.
_MAX_NOTE_CHARS = 300
#: An old snippet only has to show what was discussed, not repeat all of it.
_MAX_EPISODE_CHARS = 400
_LOCAL_ONLY_SENSITIVITIES = {Sensitivity.S3.value, Sensitivity.S4.value}


@dataclass(frozen=True)
class ContextResult:
    """The rendered block plus what it means for the audit trail."""

    text: str
    #: Contacts whose full entry reached the model, for the audit trail.
    detailed_contact_ids: list[str] = field(default_factory=list)
    #: Private contacts left out because the answering model is not local.
    withheld_private_contacts: int = 0
    #: Earlier conversations recalled into the block.
    recalled_episodes: int = 0


class ContextAssembler:
    """Build a compact, model-friendly context block from user data."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.claim_service = ClaimService(db)
        self.project_service = ProjectService(db)
        self.contact_service = ContactService(db)
        self.recall_service = MemoryRecallService(db)
        self.episode_recall = EpisodeRecallService(db)

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
        query: str = "",
        conversation_id: str | None = None,
    ) -> str:
        """Fetch and format user context, without the audit details."""
        result = await self.assemble_with_report(
            user_id=user_id,
            sensitivity=sensitivity,
            provider_is_local=provider_is_local,
            intent=intent,
            include_projects=include_projects,
            query=query,
            conversation_id=conversation_id,
        )
        return result.text

    async def assemble_with_report(
        self,
        *,
        user_id: str,
        sensitivity: Sensitivity,
        provider_is_local: bool,
        intent: str = "general_turn",
        include_projects: bool = True,
        query: str = "",
        conversation_id: str | None = None,
    ) -> ContextResult:
        """Fetch and format user context, with size-aware fallback compaction.

        ``include_projects=False`` omits the project overview, for turns where a
        single workspace is already rendered in depth elsewhere. ``query`` is the
        current user message: contacts it names are rendered in full, the rest
        stay a bare name, and earlier conversations about the same topic are
        recalled. ``conversation_id`` is the chat in progress, which is excluded
        from that recall because it is already in the prompt as history.
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

        stored_contacts = await self.contact_service.list_contacts(user_id)
        allowed_contacts = [
            contact
            for contact in stored_contacts
            if provider_is_local or contact.sensitivity not in _LOCAL_ONLY_SENSITIVITIES
        ]
        withheld = len(stored_contacts) - len(allowed_contacts)
        # Full entries for whoever the message is about; the rest stay a name.
        matches = match_contacts(query, allowed_contacts)
        detailed_ids = [str(match.contact.contact_id) for match in matches]
        contacts = allowed_contacts[:_MAX_CONTACTS]

        episodes = await self.episode_recall.recall(
            user_id=user_id,
            query=query,
            provider_is_local=provider_is_local,
            exclude_conversation_id=conversation_id,
        )

        def report(text: str, *, recalled: int) -> ContextResult:
            return ContextResult(
                text=text,
                detailed_contact_ids=detailed_ids,
                withheld_private_contacts=withheld,
                recalled_episodes=recalled,
            )

        context = self._render_context(
            claims=claims,
            projects=projects,
            contacts=contacts,
            matches=matches,
            episodes=episodes,
            tasks_by_project=tasks_by_project,
            compact_projects=False,
            compact_contacts=False,
        )
        if len(context) <= _CHAR_LIMIT:
            return report(context, recalled=len(episodes))

        prioritized_claims = self._prioritize_claims(claims)
        compact_claims = prioritized_claims[:]
        compact_contacts = contacts[:]
        compact_projects = projects[:]

        # Recall is the first thing to go: it is a guess about relevance, while
        # everything below is stored fact the user put there deliberately.
        def render_compact() -> str:
            return self._render_context(
                claims=compact_claims,
                projects=compact_projects,
                contacts=compact_contacts,
                matches=matches,
                episodes=[],
                tasks_by_project={},
                compact_projects=True,
                compact_contacts=True,
            )

        compact_context = render_compact()
        # The roster of names goes first: the entries of the people actually
        # being asked about are worth more than a list of everyone else.
        while len(compact_context) > _CHAR_LIMIT and compact_contacts:
            compact_contacts.pop()
            compact_context = render_compact()
        while len(compact_context) > _CHAR_LIMIT and compact_claims:
            compact_claims.pop()
            compact_context = render_compact()
        while len(compact_context) > _CHAR_LIMIT and compact_projects:
            compact_projects.pop()
            compact_context = render_compact()

        if len(compact_context) > _CHAR_LIMIT:
            return report(self._render_empty_context(), recalled=0)
        return report(compact_context, recalled=0)

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
        matches: list[ContactMatch],
        episodes: list[RecalledEpisode],
        tasks_by_project: dict[str, list[ProjectTask]],
        compact_projects: bool,
        compact_contacts: bool,
    ) -> str:
        if not claims and not projects and not contacts and not matches and not episodes:
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

        if matches:
            lines.extend(self._render_contact_details(matches))
            lines.append("")

        if episodes:
            lines.extend(self._render_past_conversations(episodes))
            lines.append("")

        lines.append("</user_context>")
        return "\n".join(lines)

    def _render_past_conversations(self, episodes: list[RecalledEpisode]) -> list[str]:
        """Earlier exchanges on the same topic, marked as what they are.

        They are quotes from a chat log, not confirmed memory, so the block says
        so: a claim that contradicts an old message wins.
        """
        lines = [
            f'<past_conversations count="{len(episodes)}">',
            "Excerpts from earlier chats that resemble this message. They are what was",
            "said back then, not stored fact — where a claim disagrees, the claim wins.",
        ]
        for episode in episodes:
            when = episode.created_at.date().isoformat() if episode.created_at else "unknown date"
            speaker = "you" if episode.role == "user" else "Ozy"
            lines.append(f"- {when} ({speaker}): {_shorten(episode.content, _MAX_EPISODE_CHARS)}")
        lines.append("</past_conversations>")
        return lines

    def _render_contact_details(self, matches: list[ContactMatch]) -> list[str]:
        """Everything stored about the people this message is about."""
        lines = [
            f'<contact_details count="{len(matches)}">',
            "Stored entries for the people named in this message. Quote them when asked,",
            "and say plainly when something is not stored.",
        ]
        for match in matches:
            contact = match.contact
            lines.append(
                f'<contact name="{_escape(self._person_name(contact))}" '
                f'matched_by="{match.reason}">'
            )
            lines.extend(self._contact_detail_lines(contact))
            lines.append("</contact>")
        lines.append("</contact_details>")
        return lines

    def _contact_detail_lines(self, contact: Contact) -> list[str]:
        lines: list[str] = []
        if contact.company:
            lines.append(f"Company: {contact.company}")
        if contact.role:
            lines.append(f"Role: {contact.role}")
        for entry in _entries(contact.phones):
            number = entry.get("number")
            if number:
                lines.append(f"Phone ({entry.get('label') or 'no label'}): {number}")
        for entry in _entries(contact.emails):
            email = entry.get("email")
            if email:
                lines.append(f"Email ({entry.get('label') or 'no label'}): {email}")
        if contact.address:
            lines.append(f"Address: {' '.join(contact.address.split())}")
        if contact.birthday:
            lines.append(f"Birthday: {self._format_date(contact.birthday)}")
        tags = [str(tag) for tag in contact.tags] if isinstance(contact.tags, list) else []
        if tags:
            lines.append(f"Tags: {', '.join(tags)}")
        if contact.notes:
            lines.append(f"Notes: {_shorten(contact.notes)}")
        if not lines:
            lines.append("Nothing stored beyond the name.")
        return lines

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


def _entries(value: object) -> list[dict[str, str]]:
    """Phone and email rows as stored in JSONB, skipping anything malformed."""
    if not isinstance(value, list):
        return []
    return [
        {str(key): str(item_value) for key, item_value in item.items()}
        for item in value
        if isinstance(item, dict)
    ]


def _escape(value: str) -> str:
    return value.replace('"', "'")


def _shorten(value: str, limit: int = _MAX_NOTE_CHARS) -> str:
    flattened = " ".join(value.split())
    if len(flattened) <= limit:
        return flattened
    return flattened[:limit].rstrip() + "…"
