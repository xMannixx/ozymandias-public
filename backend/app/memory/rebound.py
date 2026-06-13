"""Rebound protection: flood control after idle periods.

After a long idle gap the model tends to over-write low-value facts when a
session resumes. Rebound mode caps the number of non-identity writes per
session. Identity facts are always exempt so genuine corrections still land.
The decision is pure; the calling service tracks idle time and counters in
Redis and feeds the results here.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.memory.lanes import AuthorityClass

DEFAULT_IDLE_THRESHOLD_SECONDS = 6 * 60 * 60
DEFAULT_MAX_NON_IDENTITY_PER_SESSION = 5


def rebound_triggered(
    idle_seconds: float | None,
    *,
    threshold_seconds: int = DEFAULT_IDLE_THRESHOLD_SECONDS,
) -> bool:
    """Return ``True`` when an idle gap should activate rebound mode."""
    if idle_seconds is None:
        return False
    return idle_seconds > threshold_seconds


@dataclass(frozen=True)
class ReboundDecision:
    """Outcome of a rebound write check."""

    allowed: bool
    rebound_active: bool
    reason: str | None = None


def evaluate_rebound(
    *,
    lane: AuthorityClass,
    rebound_active: bool,
    non_identity_writes: int,
    cap: int = DEFAULT_MAX_NON_IDENTITY_PER_SESSION,
) -> ReboundDecision:
    """Decide whether a write is allowed under rebound protection."""
    if lane == AuthorityClass.identity:
        return ReboundDecision(allowed=True, rebound_active=rebound_active)
    if not rebound_active:
        return ReboundDecision(allowed=True, rebound_active=False)
    if non_identity_writes >= cap:
        return ReboundDecision(
            allowed=False,
            rebound_active=True,
            reason=(
                f"rebound cap reached ({non_identity_writes}/{cap} non-identity "
                "writes this session)"
            ),
        )
    return ReboundDecision(allowed=True, rebound_active=True)
