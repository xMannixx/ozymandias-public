"""Single-valued lane conflict resolution.

Identity and authorization lanes hold at most one current value per
``(subject, attribute)``. A new differing value conflicts with the existing
one and is auto-reconciled: the more trusted (or, at equal trust, the newer)
fact wins and the loser is superseded. Pure and deterministic.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.memory.lanes import AuthorityClass, SourceCategory, is_more_trusted, policy_for


@dataclass(frozen=True)
class FactCandidate:
    """Minimal projection of a fact for conflict reasoning."""

    value: str
    source: SourceCategory


@dataclass(frozen=True)
class SingleValuedResolution:
    """Decision for writing into a single-valued lane."""

    conflict: bool
    write_incoming: bool
    supersede_existing: bool
    reason: str | None = None


def resolve_single_valued(
    *,
    lane: AuthorityClass,
    existing: FactCandidate | None,
    incoming: FactCandidate,
) -> SingleValuedResolution:
    """Resolve a write against the current value of a single-valued lane."""
    if not policy_for(lane).single_valued:
        return SingleValuedResolution(conflict=False, write_incoming=True, supersede_existing=False)
    if existing is None:
        return SingleValuedResolution(conflict=False, write_incoming=True, supersede_existing=False)
    if existing.value.strip().lower() == incoming.value.strip().lower():
        return SingleValuedResolution(
            conflict=False,
            write_incoming=False,
            supersede_existing=False,
            reason="identical value, no-op",
        )
    # Differing value in a single-valued lane is a genuine conflict.
    incoming_wins = not is_more_trusted(existing.source, incoming.source)
    if incoming_wins:
        return SingleValuedResolution(
            conflict=True,
            write_incoming=True,
            supersede_existing=True,
            reason=(
                f"single-valued '{lane.value}' conflict: incoming "
                f"('{incoming.source.value}') supersedes existing "
                f"('{existing.source.value}')"
            ),
        )
    return SingleValuedResolution(
        conflict=True,
        write_incoming=False,
        supersede_existing=False,
        reason=(
            f"single-valued '{lane.value}' conflict: existing "
            f"('{existing.source.value}') is more trusted than incoming "
            f"('{incoming.source.value}'); incoming rejected"
        ),
    )
