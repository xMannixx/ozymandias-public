"""Tests for lane-coupled decay and provenance reconstruction."""

from typing import Any

from app.memory.lanes import AuthorityClass
from app.memory.lifecycle import evaluate_lane_decay
from app.memory.provenance import reconstruct


def test_identity_never_decays() -> None:
    decision = evaluate_lane_decay(lane=AuthorityClass.identity, confidence=0.95, age_days=10_000)
    assert decision.action == "keep"


def test_user_locked_keeps() -> None:
    decision = evaluate_lane_decay(
        lane=AuthorityClass.preference, confidence=0.9, age_days=999, user_locked=True
    )
    assert decision.action == "keep"


def test_ttl_expiry() -> None:
    decision = evaluate_lane_decay(lane=AuthorityClass.preference, confidence=0.9, age_days=100)
    assert decision.action == "expire"


def test_half_life_reduces_confidence() -> None:
    decision = evaluate_lane_decay(lane=AuthorityClass.evidence, confidence=0.9, age_days=30)
    assert decision.action in {"reduce", "expire"}
    if decision.action == "reduce":
        assert decision.new_confidence is not None
        assert decision.new_confidence < 0.9


def _event(event_type: str, timestamp: str, claim_id: str) -> dict[str, Any]:
    return {
        "event_type": event_type,
        "result": "success",
        "timestamp": timestamp,
        "payload": {"claim_id": claim_id},
    }


def test_provenance_orders_by_timestamp() -> None:
    events = [
        _event("memory_retracted", "2026-02-01", "c1"),
        _event("memory_confirmed", "2026-01-01", "c1"),
        _event("turn_processed", "2026-01-15", "other"),
    ]
    chain = reconstruct(events, target_id="c1")
    assert [e.event_type for e in chain] == ["memory_confirmed", "memory_retracted"]


def test_provenance_ignores_unrelated() -> None:
    events = [_event("x", "2026-01-01", "z")]
    assert reconstruct(events, target_id="c1") == []
