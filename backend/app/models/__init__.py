"""SQLAlchemy model package."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base declarative class for all ORM models."""


from app.models.audit import AuditLog  # noqa: E402
from app.models.claim import Claim, ClaimAccessLog, ClaimVersion  # noqa: E402
from app.models.conflict import ConflictGroup, ConflictGroupClaim  # noqa: E402
from app.models.contact import Contact, ContactProject  # noqa: E402
from app.models.conversation import Conversation, ConversationMessage  # noqa: E402
from app.models.google_tokens import GoogleToken  # noqa: E402
from app.models.memory import (  # noqa: E402
    BehavioralRule,
    BehavioralRuleConflict,
    MemoryEntity,
    MemoryEntityRelation,
    RecallSnippet,
)
from app.models.project import (  # noqa: E402
    Project,
    ProjectFile,
    ProjectLink,
    ProjectNote,
    ProjectTask,
)
from app.models.proposal import MemoryProposal  # noqa: E402
from app.models.settings import UserSettings  # noqa: E402
from app.models.usage import LLMUsageEvent  # noqa: E402
from app.models.user import Episode, ProceduralRule  # noqa: E402

__all__ = [
    "AuditLog",
    "Base",
    "BehavioralRule",
    "BehavioralRuleConflict",
    "Claim",
    "ClaimAccessLog",
    "ClaimVersion",
    "ConflictGroup",
    "ConflictGroupClaim",
    "Contact",
    "ContactProject",
    "Conversation",
    "ConversationMessage",
    "Episode",
    "GoogleToken",
    "LLMUsageEvent",
    "MemoryEntity",
    "MemoryEntityRelation",
    "MemoryProposal",
    "RecallSnippet",
    "Project",
    "ProjectFile",
    "ProjectLink",
    "ProjectNote",
    "ProjectTask",
    "ProceduralRule",
    "UserSettings",
]
