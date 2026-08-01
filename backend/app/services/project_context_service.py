"""Build the workspace context block for a chat turn inside a project.

A project is a workspace: it carries standing instructions, open work, notes
and knowledge extracted from uploaded files. Only the parts relevant to the
current message are injected, capped by a character budget so a large
knowledge base cannot crowd out the conversation itself.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.memory.text_norm import query_terms
from app.models.project import Project, ProjectFile, ProjectLink, ProjectNote, ProjectTask
from app.schemas import Sensitivity
from app.services.project_service import ProjectService

#: Characters of file knowledge that may enter one turn.
KNOWLEDGE_CHAR_BUDGET = 4000
#: Target size of one knowledge excerpt.
CHUNK_CHARS = 700
MAX_TASKS = 20
MAX_NOTES = 10
MAX_LINKS = 10

_LOCAL_ONLY_SENSITIVITIES = frozenset({Sensitivity.S3.value, Sensitivity.S4.value})


@dataclass(frozen=True)
class ProjectContext:
    """Rendered workspace block plus what it means for routing and audit."""

    project_id: str
    project_name: str
    sensitivity: str
    #: True when the project's sensitivity forbids sending its content to a cloud.
    force_local: bool
    text: str
    knowledge_files: list[str] = field(default_factory=list)
    knowledge_chars: int = 0


@dataclass(frozen=True)
class _Excerpt:
    filename: str
    text: str
    score: float


class ProjectContextService:
    """Assemble one project's instructions, work and knowledge for a turn."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.project_service = ProjectService(db)

    async def build(
        self,
        *,
        user_id: str,
        project_id: str,
        query: str,
    ) -> ProjectContext:
        """Return the workspace context, raising NotFoundError for a foreign project."""
        project = await self.project_service.get_project(project_id, user_id)

        tasks = await self.project_service.list_tasks(project_id, user_id)
        open_tasks = [task for task in tasks if task.status != "done"][:MAX_TASKS]
        notes = (await self.project_service.list_notes(project_id, user_id))[:MAX_NOTES]
        links = (await self.project_service.list_links(project_id, user_id))[:MAX_LINKS]
        files = await self.project_service.list_files(project_id, user_id)

        excerpts = self._select_knowledge(files=files, query=query)
        text = self._render(
            project=project,
            open_tasks=open_tasks,
            notes=notes,
            links=links,
            excerpts=excerpts,
        )

        return ProjectContext(
            project_id=str(project.project_id),
            project_name=project.name,
            sensitivity=project.sensitivity,
            force_local=project.sensitivity in _LOCAL_ONLY_SENSITIVITIES,
            text=text,
            knowledge_files=sorted({excerpt.filename for excerpt in excerpts}),
            knowledge_chars=sum(len(excerpt.text) for excerpt in excerpts),
        )

    def _select_knowledge(self, *, files: list[ProjectFile], query: str) -> list[_Excerpt]:
        """Pick knowledge excerpts that fit the budget, preferring relevance.

        Small knowledge bases are injected whole so nothing is silently lost.
        """
        readable = [
            file_row
            for file_row in files
            if file_row.extract_status == "ok" and file_row.extracted_text
        ]
        if not readable:
            return []

        total_chars = sum(len(file_row.extracted_text or "") for file_row in readable)
        if total_chars <= KNOWLEDGE_CHAR_BUDGET:
            return [
                _Excerpt(
                    filename=file_row.original_name,
                    text=(file_row.extracted_text or "").strip(),
                    score=1.0,
                )
                for file_row in readable
            ]

        terms = query_terms(query)
        candidates: list[_Excerpt] = []
        for file_row in readable:
            for chunk in _chunk_text(file_row.extracted_text or ""):
                candidates.append(
                    _Excerpt(
                        filename=file_row.original_name,
                        text=chunk,
                        score=_relevance(chunk=chunk, terms=terms),
                    )
                )

        # Stable ordering: relevance first, then original document order.
        ranked = sorted(
            enumerate(candidates),
            key=lambda pair: (-pair[1].score, pair[0]),
        )

        selected: list[_Excerpt] = []
        used = 0
        for _, excerpt in ranked:
            if used + len(excerpt.text) > KNOWLEDGE_CHAR_BUDGET:
                continue
            selected.append(excerpt)
            used += len(excerpt.text)
        return selected

    def _render(
        self,
        *,
        project: Project,
        open_tasks: list[ProjectTask],
        notes: list[ProjectNote],
        links: list[ProjectLink],
        excerpts: list[_Excerpt],
    ) -> str:
        lines = [
            f'<workspace name="{_escape(project.name)}" sensitivity="{project.sensitivity}">',
            "The user is working inside this project. Prefer its instructions and",
            "knowledge over general assumptions.",
            "",
        ]

        if project.description:
            lines.extend(["<about>", project.description.strip(), "</about>", ""])

        if project.instructions:
            lines.extend(
                [
                    "<instructions>",
                    project.instructions.strip(),
                    "</instructions>",
                    "",
                ]
            )

        if open_tasks:
            lines.append(f'<open_work count="{len(open_tasks)}">')
            for task in open_tasks:
                detail = [task.status, task.priority]
                if task.due_date:
                    detail.append(f"due {task.due_date.isoformat()}")
                lines.append(f"- {task.name} [{', '.join(detail)}]")
            lines.extend(["</open_work>", ""])

        if notes:
            lines.append(f'<notes count="{len(notes)}">')
            for note in notes:
                lines.append(f"- {_one_line(note.content)}")
            lines.extend(["</notes>", ""])

        if links:
            lines.append(f'<links count="{len(links)}">')
            for link in links:
                lines.append(f"- {link.name}: {link.url}")
            lines.extend(["</links>", ""])

        if excerpts:
            file_count = len({excerpt.filename for excerpt in excerpts})
            lines.append(f'<knowledge files="{file_count}">')
            current: str | None = None
            for excerpt in excerpts:
                if excerpt.filename != current:
                    current = excerpt.filename
                    lines.append(f"--- {excerpt.filename} ---")
                lines.append(excerpt.text)
            lines.extend(["</knowledge>", ""])

        lines.append("</workspace>")
        return "\n".join(lines)


def _chunk_text(text: str) -> list[str]:
    """Split into paragraph-aligned chunks of roughly CHUNK_CHARS characters."""
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    chunks: list[str] = []
    buffer: list[str] = []
    size = 0
    for paragraph in paragraphs:
        if size and size + len(paragraph) > CHUNK_CHARS:
            chunks.append("\n\n".join(buffer))
            buffer = []
            size = 0
        buffer.append(paragraph)
        size += len(paragraph)
    if buffer:
        chunks.append("\n\n".join(buffer))
    return chunks


def _relevance(*, chunk: str, terms: set[str]) -> float:
    """Term-overlap score, damped by chunk length so long chunks don't win by size."""
    if not terms:
        return 0.0
    chunk_terms = query_terms(chunk)
    if not chunk_terms:
        return 0.0
    overlap = len(terms & chunk_terms)
    if not overlap:
        return 0.0
    return overlap / math.sqrt(len(chunk_terms))


def _one_line(value: str) -> str:
    return " ".join(value.split())


def _escape(value: str) -> str:
    return value.replace('"', "'")
