"""Tests for rebound protection decisions."""

from app.memory.lanes import AuthorityClass
from app.memory.rebound import evaluate_rebound, rebound_triggered


def test_idle_below_threshold_no_rebound() -> None:
    assert rebound_triggered(60 * 60) is False


def test_idle_above_threshold_triggers() -> None:
    assert rebound_triggered(7 * 60 * 60) is True


def test_none_idle_no_rebound() -> None:
    assert rebound_triggered(None) is False


def test_identity_exempt_from_cap() -> None:
    decision = evaluate_rebound(
        lane=AuthorityClass.identity, rebound_active=True, non_identity_writes=99
    )
    assert decision.allowed is True


def test_non_identity_blocked_when_cap_reached() -> None:
    decision = evaluate_rebound(
        lane=AuthorityClass.evidence,
        rebound_active=True,
        non_identity_writes=5,
        cap=5,
    )
    assert decision.allowed is False
    assert "cap" in (decision.reason or "")


def test_non_identity_allowed_when_not_in_rebound() -> None:
    decision = evaluate_rebound(
        lane=AuthorityClass.evidence, rebound_active=False, non_identity_writes=99
    )
    assert decision.allowed is True
