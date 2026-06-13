"""Query-aware memory recall and prompt-injection assembly.

The current user message is the query. Claims are scored deterministically
(term overlap + synonyms + per-lane budgets), an identity floor is always
included, related entity edges are added 1-hop, and only triggered, sanitized
active behavioral rules are injected. The authorization lane is never injected.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.memory import retrieval, rules
from app.memory.lanes import AuthorityClass
from app.memory.text_norm import query_terms
from app.models.claim import Claim
from app.models.memory import BehavioralRule, MemoryEntity, MemoryEntityRelation
from app.schemas import VerificationState
from app.services.utils import normalize_user_id

_NEW_RULE_WINDOW = timedelta(days=3)
_MAX_RELATIONS = 12
_MAX_RULE_TEXT = 240


@dataclass(frozen=True)
class RecallResult:
    """Structured recall payload plus its rendered injection block."""

    identity: list[retrieval.Candidate]
    relevant: list[retrieval.ScoredCandidate]
    related_edges: list[str]
    rules: list[str]
    text: str


class MemoryRecallService:
    """Build a query-relevant memory injection block for a turn."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def recall(
        self,
        *,
        user_id: str,
        query: str,
        provider_is_local: bool = True,
        per_lane_char_budget: int = 1200,
    ) -> RecallResult:
        """Assemble identity floor, relevant facts, relations and rules."""
        uid = normalize_user_id(user_id)
        candidates = await self._load_fact_candidates(uid, provider_is_local)
        injection = retrieval.assemble(query, candidates, per_lane_char_budget=per_lane_char_budget)
        related = await self._load_related_edges(uid, query)
        triggered_rules = await self._load_triggered_rules(uid, query)

        text = self._render(injection, related, triggered_rules)
        return RecallResult(
            identity=injection.identity,
            relevant=injection.relevant,
            related_edges=related,
            rules=triggered_rules,
            text=text,
        )

    async def _load_fact_candidates(
        self, uid: uuid.UUID, provider_is_local: bool
    ) -> list[retrieval.Candidate]:
        from app.schemas import Sensitivity

        stmt = select(Claim).where(
            Claim.user_id == uid,
            Claim.verification_state.notin_(
                [VerificationState.superseded.value, VerificationState.retracted.value]
            ),
        )
        result = await self.db.execute(stmt)
        claims = list(result.scalars().all())
        candidates: list[retrieval.Candidate] = []
        for claim in claims:
            if not provider_is_local and claim.sensitivity in {
                Sensitivity.S3.value,
                Sensitivity.S4.value,
            }:
                continue
            lane = _safe_lane(claim.authority_class)
            candidates.append(
                retrieval.Candidate(
                    id=str(claim.claim_id),
                    lane=lane,
                    subject=claim.subject,
                    content=claim.content,
                    confidence=float(claim.confidence),
                )
            )
        return candidates

    async def _load_related_edges(self, uid: uuid.UUID, query: str) -> list[str]:
        terms = query_terms(query)
        if not terms:
            return []
        entity_stmt = select(MemoryEntity).where(MemoryEntity.user_id == uid)
        entity_result = await self.db.execute(entity_stmt)
        entities = list(entity_result.scalars().all())
        matched = {e.entity_id: e.name for e in entities if query_terms(e.name) & terms}
        if not matched:
            return []
        names = {e.entity_id: e.name for e in entities}
        relation_stmt = select(MemoryEntityRelation).where(
            MemoryEntityRelation.user_id == uid,
            or_(
                MemoryEntityRelation.subject_id.in_(list(matched)),
                MemoryEntityRelation.object_id.in_(list(matched)),
            ),
        )
        relation_result = await self.db.execute(relation_stmt)
        edges: list[str] = []
        for rel in relation_result.scalars().all():
            subject = names.get(rel.subject_id, "?")
            obj = names.get(rel.object_id, "?")
            edges.append(f"{subject} -[{rel.predicate}]-> {obj}")
            if len(edges) >= _MAX_RELATIONS:
                break
        return edges

    async def _load_triggered_rules(self, uid: uuid.UUID, query: str) -> list[str]:
        now = datetime.now(tz=UTC)
        stmt = select(BehavioralRule).where(
            BehavioralRule.user_id == uid,
            BehavioralRule.status == "active",
        )
        result = await self.db.execute(stmt)
        rendered: list[str] = []
        for rule in result.scalars().all():
            if rule.expires_at is not None and _aware(rule.expires_at) <= now:
                continue
            if not rules.is_triggered(rule.trigger_json or {}, query):
                continue
            is_new = (
                rule.activated_at is not None
                and now - _aware(rule.activated_at) <= _NEW_RULE_WINDOW
            )
            prefix = "[NEW] " if is_new else ""
            rendered.append(f"{prefix}{_sanitize(rule.behavior_text)}")
        return rendered

    @staticmethod
    def _render(
        injection: retrieval.InjectionResult,
        related: list[str],
        rule_lines: list[str],
    ) -> str:
        sections: list[str] = []
        facts = injection.render()
        if facts:
            sections.append(facts)
        if related:
            sections.append("## Related\n" + "\n".join(f"- {edge}" for edge in related))
        if rule_lines:
            sections.append("## Procedural Rules\n" + "\n".join(f"- {line}" for line in rule_lines))
        if not sections:
            return ""
        return "<memory_recall>\n" + "\n".join(sections) + "\n</memory_recall>"


def _safe_lane(value: str) -> AuthorityClass:
    try:
        return AuthorityClass(value)
    except ValueError:
        return AuthorityClass.evidence


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _sanitize(text: str) -> str:
    """Bound and neutralize rule text before injecting into a prompt."""
    flattened = " ".join(text.split())
    for marker in ("<", ">", "```", "system:", "assistant:", "user:"):
        flattened = flattened.replace(marker, " ")
    flattened = " ".join(flattened.split())
    if len(flattened) > _MAX_RULE_TEXT:
        flattened = flattened[:_MAX_RULE_TEXT].rstrip() + "…"
    return flattened
