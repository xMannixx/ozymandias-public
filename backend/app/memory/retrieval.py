"""Query-aware relevance scoring and budgeted injection assembly.

Pure and deterministic. The current user message is the query; candidate facts
are scored by expanded term overlap, coverage and confidence. The identity lane
is an always-present floor; other injectable lanes compete for a per-lane
character budget. The authorization lane is never injected.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.memory.lanes import AuthorityClass, policy_for
from app.memory.text_norm import query_terms


@dataclass(frozen=True)
class Candidate:
    """A scorable fact projected from a claim."""

    id: str
    lane: AuthorityClass
    subject: str
    content: str
    confidence: float


@dataclass(frozen=True)
class ScoredCandidate:
    """A candidate with its relevance score."""

    candidate: Candidate
    score: float


def score_candidate(q_terms: set[str], candidate: Candidate) -> float:
    """Score one candidate against the expanded query term set."""
    if not q_terms:
        return 0.0
    content_terms = query_terms(candidate.content)
    subject_terms = query_terms(candidate.subject)
    overlap = len(q_terms & content_terms)
    if overlap == 0 and not (q_terms & subject_terms):
        return 0.0
    coverage = overlap / len(q_terms)
    subject_bonus = 0.5 if (q_terms & subject_terms) else 0.0
    return overlap + 0.5 * coverage + 0.25 * candidate.confidence + subject_bonus


def rank(query: str, candidates: list[Candidate]) -> list[ScoredCandidate]:
    """Rank candidates by relevance (desc), stable on confidence then id."""
    q_terms = query_terms(query)
    scored = [
        ScoredCandidate(candidate=item, score=score_candidate(q_terms, item)) for item in candidates
    ]
    scored.sort(key=lambda sc: (-sc.score, -sc.candidate.confidence, sc.candidate.id))
    return scored


@dataclass
class InjectionResult:
    """Structured, budget-bounded retrieval result for prompt assembly."""

    identity: list[Candidate] = field(default_factory=list)
    relevant: list[ScoredCandidate] = field(default_factory=list)

    def render(self) -> str:
        """Render the fact portion of the memory injection block."""
        lines: list[str] = []
        if self.identity:
            lines.append("## Identity")
            for cand in self.identity:
                lines.append(f"- {cand.content}")
        if self.relevant:
            lines.append("## Relevant")
            for scored in self.relevant:
                lines.append(f"- {scored.candidate.content}")
        return "\n".join(lines)


def assemble(
    query: str,
    candidates: list[Candidate],
    *,
    per_lane_char_budget: int = 1200,
    min_score: float = 0.01,
) -> InjectionResult:
    """Select identity floor plus query-relevant facts within lane budgets."""
    result = InjectionResult()

    identity = [c for c in candidates if c.lane == AuthorityClass.identity]
    identity.sort(key=lambda c: (-c.confidence, c.id))
    used = 0
    for cand in identity:
        cost = len(cand.content) + 3
        if used + cost > per_lane_char_budget:
            break
        result.identity.append(cand)
        used += cost

    injectable = [
        c for c in candidates if c.lane != AuthorityClass.identity and policy_for(c.lane).injectable
    ]
    ranked = [sc for sc in rank(query, injectable) if sc.score >= min_score]

    budgets: dict[AuthorityClass, int] = {}
    for scored in ranked:
        lane = scored.candidate.lane
        spent = budgets.get(lane, 0)
        cost = len(scored.candidate.content) + 3
        if spent + cost > per_lane_char_budget:
            continue
        result.relevant.append(scored)
        budgets[lane] = spent + cost
    return result
