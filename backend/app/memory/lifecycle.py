"""Lane-coupled decay and expiry decisions.

Each lane decays on its own schedule: ``half_life_days`` drives confidence
decay, ``ttl_days`` drives hard expiry. Identity has neither and never decays.
Pure and deterministic so the Celery cleanup job is fully reproducible.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.memory.lanes import AuthorityClass, policy_for


@dataclass(frozen=True)
class LaneDecayDecision:
    """Decay verdict for a single fact in a lane."""

    action: str  # keep | reduce | expire
    new_confidence: float | None = None
    reason: str | None = None


def evaluate_lane_decay(
    *,
    lane: AuthorityClass,
    confidence: float,
    age_days: float,
    user_locked: bool = False,
) -> LaneDecayDecision:
    """Decide keep/reduce/expire for a fact based on its lane policy and age."""
    if user_locked:
        return LaneDecayDecision(action="keep", reason="user_locked")
    policy = policy_for(lane)

    if policy.ttl_days is not None and age_days > policy.ttl_days:
        return LaneDecayDecision(
            action="expire",
            reason=f"age {age_days:.1f}d exceeds ttl {policy.ttl_days}d for '{lane.value}'",
        )

    if policy.half_life_days is None or policy.half_life_days <= 0:
        return LaneDecayDecision(action="keep", reason="no half-life")

    decayed = confidence * (0.5 ** (age_days / policy.half_life_days))
    if decayed < policy.min_confidence:
        return LaneDecayDecision(
            action="expire",
            new_confidence=round(decayed, 4),
            reason=(
                f"decayed confidence {decayed:.3f} below floor "
                f"{policy.min_confidence:.2f} for '{lane.value}'"
            ),
        )
    if decayed < confidence - 1e-9:
        return LaneDecayDecision(action="reduce", new_confidence=round(decayed, 4))
    return LaneDecayDecision(action="keep")
