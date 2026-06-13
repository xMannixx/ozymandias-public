"""Provenance reconstruction from the append-only audit log.

No separate provenance table: the lifecycle of a claim (write, confirm,
supersede, retract, conflict) is reconstructed read-only by filtering and
ordering audit events that reference its id. Pure and deterministic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ProvenanceEvent:
    """A single ordered step in a claim's history."""

    event_type: str
    result: str
    actor: str
    detail: str
    timestamp: str | None


def _references_target(event: dict[str, Any], target_id: str) -> bool:
    if event.get("target_id") == target_id:
        return True
    payload = event.get("payload")
    if isinstance(payload, dict):
        for key in ("claim_id", "rule_id", "target_id", "proposal_id"):
            if str(payload.get(key)) == target_id:
                return True
    return False


def reconstruct(events: list[dict[str, Any]], *, target_id: str) -> list[ProvenanceEvent]:
    """Build the ordered provenance chain for one target id."""
    relevant = [event for event in events if _references_target(event, target_id)]
    relevant.sort(key=lambda event: str(event.get("timestamp") or event.get("created_at") or ""))
    return [
        ProvenanceEvent(
            event_type=str(event.get("event_type", "")),
            result=str(event.get("result", "")),
            actor=str(event.get("actor", "")),
            detail=str(event.get("detail", "")),
            timestamp=(
                str(event["timestamp"])
                if event.get("timestamp")
                else (str(event["created_at"]) if event.get("created_at") else None)
            ),
        )
        for event in relevant
    ]
