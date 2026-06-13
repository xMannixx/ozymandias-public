"""Authority lanes and source-trust write policy.

Not every fact is equal. Each lane carries its own TTL, confidence floor,
allowed source categories and single-valued semantics. Lower-trust input
(``tool`` / ``external``) is quarantined to the ``evidence`` lane so poisoned
connector output cannot escalate into identity, permission or behavior memory.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class AuthorityClass(StrEnum):
    """Memory lane with its own lifecycle and trust policy."""

    identity = "identity"
    preference = "preference"
    evidence = "evidence"
    authorization = "authorization"
    procedural = "procedural"


class SourceCategory(StrEnum):
    """Trust-ranked origin of a fact (most to least trusted)."""

    observation = "observation"
    conversation = "conversation"
    inference = "inference"
    tool = "tool"
    external = "external"


# Most trusted first. Used for tie-breaking and write-policy reasoning.
SOURCE_TRUST_ORDER: tuple[SourceCategory, ...] = (
    SourceCategory.observation,
    SourceCategory.conversation,
    SourceCategory.inference,
    SourceCategory.tool,
    SourceCategory.external,
)


@dataclass(frozen=True)
class LanePolicy:
    """Immutable per-lane policy."""

    ttl_days: int | None
    half_life_days: int | None
    min_confidence: float
    allowed_sources: tuple[SourceCategory, ...]
    single_valued: bool
    # ``authorization`` is never auto-injected into prompt context.
    injectable: bool


AUTHORITY_POLICY: dict[AuthorityClass, LanePolicy] = {
    AuthorityClass.identity: LanePolicy(
        ttl_days=None,
        half_life_days=None,
        min_confidence=0.9,
        allowed_sources=(SourceCategory.observation, SourceCategory.conversation),
        single_valued=True,
        injectable=True,
    ),
    AuthorityClass.preference: LanePolicy(
        ttl_days=14,
        half_life_days=7,
        min_confidence=0.3,
        allowed_sources=(SourceCategory.observation, SourceCategory.conversation),
        single_valued=False,
        injectable=True,
    ),
    AuthorityClass.evidence: LanePolicy(
        ttl_days=60,
        half_life_days=30,
        min_confidence=0.5,
        allowed_sources=(
            SourceCategory.observation,
            SourceCategory.conversation,
            SourceCategory.inference,
            SourceCategory.tool,
            SourceCategory.external,
        ),
        single_valued=False,
        injectable=True,
    ),
    AuthorityClass.authorization: LanePolicy(
        ttl_days=90,
        half_life_days=45,
        min_confidence=0.9,
        allowed_sources=(SourceCategory.observation,),
        single_valued=True,
        injectable=False,
    ),
    AuthorityClass.procedural: LanePolicy(
        ttl_days=30,
        half_life_days=None,
        min_confidence=0.5,
        allowed_sources=(SourceCategory.observation,),
        single_valued=False,
        injectable=True,
    ),
}

# Bridge the legacy ``SourceType`` vocabulary to trust-ranked categories.
_SOURCE_TYPE_TO_CATEGORY: dict[str, SourceCategory] = {
    "user_explicit": SourceCategory.observation,
    "user_confirmed": SourceCategory.observation,
    "model_inferred": SourceCategory.inference,
    "connector_data": SourceCategory.external,
}


def policy_for(lane: AuthorityClass) -> LanePolicy:
    """Return the immutable policy for one lane."""
    return AUTHORITY_POLICY[lane]


def source_category_from_type(source_type: str) -> SourceCategory:
    """Map a legacy ``SourceType`` value to a trust category.

    Unknown values fall back to the least-trusted ``external`` category so an
    unexpected source can never silently gain identity/authorization rights.
    """
    return _SOURCE_TYPE_TO_CATEGORY.get(source_type, SourceCategory.external)


@dataclass(frozen=True)
class WritePolicyResult:
    """Outcome of a lane write-policy check."""

    allowed: bool
    reason: str | None = None


def check_write_policy(
    *,
    lane: AuthorityClass,
    source: SourceCategory,
    confidence: float,
) -> WritePolicyResult:
    """Decide whether a fact may be written to a lane.

    Enforces allowed source categories per lane and the lane confidence floor.
    """
    policy = AUTHORITY_POLICY[lane]
    if source not in policy.allowed_sources:
        allowed = ", ".join(item.value for item in policy.allowed_sources)
        return WritePolicyResult(
            allowed=False,
            reason=(
                f"source '{source.value}' not allowed for lane '{lane.value}' (allowed: {allowed})"
            ),
        )
    if confidence < policy.min_confidence:
        return WritePolicyResult(
            allowed=False,
            reason=(
                f"confidence {confidence:.2f} below floor "
                f"{policy.min_confidence:.2f} for lane '{lane.value}'"
            ),
        )
    return WritePolicyResult(allowed=True)


def is_more_trusted(left: SourceCategory, right: SourceCategory) -> bool:
    """Return ``True`` if ``left`` is strictly more trusted than ``right``."""
    return SOURCE_TRUST_ORDER.index(left) < SOURCE_TRUST_ORDER.index(right)
