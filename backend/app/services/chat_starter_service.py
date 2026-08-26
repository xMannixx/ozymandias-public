"""Suggestions for the empty chat screen.

The four hardcoded examples were identical on every visit and said nothing about
the account they were shown in. These are built from what is actually open right
now — proposals, flagged memories, overdue tasks, the project last touched — and
the remaining slots are filled from a rotating pool so the screen changes.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.briefing import Briefing
from app.models.claim import Claim
from app.models.conversation import Conversation
from app.models.project import Project, ProjectTask
from app.models.proposal import MemoryProposal
from app.services.utils import normalize_user_id

#: The empty state renders a 2x2 grid.
MAX_STARTERS = 4

#: Titles sit on a button next to an icon; longer ones wrap into three lines.
MAX_TITLE_CHARS = 32


@dataclass(frozen=True)
class ChatStarter:
    """One suggestion button: what it says and what it sends."""

    id: str
    #: Semantic name; the frontend maps it to an icon and falls back if unknown.
    icon: str
    title: str
    prompt: str


#: Fillers for accounts that have nothing pending, and for the empty slots left
#: over once the personal suggestions run out.
GENERIC_STARTERS: tuple[ChatStarter, ...] = (
    ChatStarter(
        id="remember",
        icon="memory",
        title="Remember something",
        prompt="Remember that I prefer coffee without sugar.",
    ),
    ChatStarter(
        id="brainstorm",
        icon="idea",
        title="Brainstorm an idea",
        prompt="Give me three ideas to speed up my morning routine.",
    ),
    ChatStarter(
        id="plan",
        icon="plan",
        title="Plan a task",
        prompt="Help me draft a plan for a two-day trip to Amsterdam.",
    ),
    ChatStarter(
        id="recall",
        icon="search",
        title="Recall context",
        prompt="What do you remember about my current projects?",
    ),
    ChatStarter(
        id="week",
        icon="chat",
        title="Sum up my week",
        prompt="What did we work on over the past week?",
    ),
    ChatStarter(
        id="decide",
        icon="idea",
        title="Weigh a decision",
        prompt="Help me weigh two options and name the trade-offs honestly.",
    ),
    ChatStarter(
        id="stale",
        icon="memory",
        title="Find stale memory",
        prompt="What do you know about me that is probably out of date by now?",
    ),
    ChatStarter(
        id="next",
        icon="tasks",
        title="Find the next step",
        prompt="Looking at my projects, what should I work on next?",
    ),
    ChatStarter(
        id="draft",
        icon="mail",
        title="Draft a message",
        prompt="Draft a short, friendly message declining a meeting invitation.",
    ),
    ChatStarter(
        id="explain",
        icon="idea",
        title="Explain a trade-off",
        prompt="Explain the trade-offs of keeping an assistant's memory local.",
    ),
)


class ChatStarterService:
    """Pick the suggestions shown before the first message of a chat."""

    def __init__(self, db: AsyncSession, *, rng: random.Random | None = None) -> None:
        self.db = db
        # Injectable so tests get a fixed draw instead of a fresh one per call.
        self._rng = rng or random.Random()

    async def suggest(self, *, user_id: str, limit: int = MAX_STARTERS) -> list[ChatStarter]:
        """Personal suggestions first, generic ones for whatever is left over.

        One slot always stays generic. Open items are the same until they are
        dealt with, so without a reserved slot the "other suggestions" button
        would appear to do nothing for a busy account.
        """
        found = [
            starter
            for starter in [
                await self._briefing_starter(user_id),
                await self._proposal_starter(user_id),
                await self._task_starter(user_id),
                await self._memory_starter(user_id),
                await self._project_starter(user_id),
                await self._conversation_starter(user_id),
            ]
            if starter is not None
        ]
        starters = found[: max(limit - 1, 1)]
        missing = limit - len(starters)
        if missing > 0:
            starters.extend(self._rng.sample(GENERIC_STARTERS, k=missing))
        return starters

    async def _briefing_starter(self, user_id: str) -> ChatStarter | None:
        today = datetime.now(tz=UTC).date()
        stmt = select(Briefing.briefing_id).where(
            Briefing.user_id == normalize_user_id(user_id),
            Briefing.briefing_date == today,
        )
        result = await self.db.execute(stmt)
        if result.scalar_one_or_none() is None:
            return None
        return ChatStarter(
            id="briefing",
            icon="briefing",
            title="Walk me through today",
            prompt="Walk me through my briefing for today and what needs a decision.",
        )

    async def _proposal_starter(self, user_id: str) -> ChatStarter | None:
        stmt = select(func.count()).where(
            MemoryProposal.user_id == normalize_user_id(user_id),
            MemoryProposal.status == "pending",
        )
        count = await self._count(stmt)
        if count == 0:
            return None
        return ChatStarter(
            id="proposals",
            icon="proposals",
            title=f"Review {_plural(count, 'proposal')}",
            prompt="Which memory proposals are waiting for me, and what do they claim?",
        )

    async def _task_starter(self, user_id: str) -> ChatStarter | None:
        today = datetime.now(tz=UTC).date()
        stmt = select(func.count()).where(
            ProjectTask.user_id == user_id,
            ProjectTask.status != "done",
            ProjectTask.due_date.is_not(None),
            ProjectTask.due_date <= today,
        )
        count = await self._count(stmt)
        if count == 0:
            return None
        return ChatStarter(
            id="tasks",
            icon="tasks",
            title=f"{_plural(count, 'task')} due",
            prompt="Which of my project tasks are due or overdue, and which comes first?",
        )

    async def _memory_starter(self, user_id: str) -> ChatStarter | None:
        stmt = select(func.count()).where(
            Claim.user_id == normalize_user_id(user_id),
            Claim.review_due.is_(True),
            Claim.verification_state.notin_(["retracted", "superseded"]),
        )
        count = await self._count(stmt)
        if count == 0:
            return None
        return ChatStarter(
            id="memory-review",
            icon="memory",
            title=f"Check {_plural(count, 'memory', 'memories')}",
            prompt="Which of my memories are flagged for review, and are they still true?",
        )

    async def _project_starter(self, user_id: str) -> ChatStarter | None:
        stmt = (
            select(Project.name)
            .where(Project.user_id == user_id, Project.status == "active")
            .order_by(Project.updated_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        name = result.scalars().first()
        if not name:
            return None
        return ChatStarter(
            id="project",
            icon="project",
            title=_fit(name),
            prompt=f"Where do I stand on {name}, and what is the next open point?",
        )

    async def _conversation_starter(self, user_id: str) -> ChatStarter | None:
        stmt = (
            select(Conversation.title)
            .where(
                Conversation.user_id == normalize_user_id(user_id),
                Conversation.title != "New chat",
            )
            .order_by(Conversation.updated_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        title = result.scalars().first()
        if not title:
            return None
        return ChatStarter(
            id="continue",
            icon="chat",
            title="Pick up where we left off",
            prompt=f'Let us continue our conversation about "{title}".',
        )

    async def _count(self, stmt: Select[tuple[int]]) -> int:
        result = await self.db.execute(stmt)
        return int(result.scalar() or 0)


def _plural(count: int, noun: str, plural: str | None = None) -> str:
    word = noun if count == 1 else (plural or f"{noun}s")
    return f"{count} {word}"


def _fit(text: str) -> str:
    """Keep a title on two lines at most."""
    collapsed = " ".join(text.split())
    if len(collapsed) <= MAX_TITLE_CHARS:
        return collapsed
    return collapsed[: MAX_TITLE_CHARS - 1].rstrip() + "\u2026"
