"""Tests for single-valued lane conflict resolution."""

from app.memory.conflicts import FactCandidate, resolve_single_valued
from app.memory.lanes import AuthorityClass, SourceCategory


def test_evidence_lane_never_conflicts() -> None:
    res = resolve_single_valued(
        lane=AuthorityClass.evidence,
        existing=FactCandidate("a", SourceCategory.observation),
        incoming=FactCandidate("b", SourceCategory.observation),
    )
    assert res.conflict is False
    assert res.write_incoming is True


def test_first_value_no_conflict() -> None:
    res = resolve_single_valued(
        lane=AuthorityClass.identity,
        existing=None,
        incoming=FactCandidate("Alex", SourceCategory.observation),
    )
    assert res.conflict is False
    assert res.write_incoming is True


def test_identical_value_is_noop() -> None:
    res = resolve_single_valued(
        lane=AuthorityClass.identity,
        existing=FactCandidate("Alex", SourceCategory.observation),
        incoming=FactCandidate("alex ", SourceCategory.observation),
    )
    assert res.conflict is False
    assert res.write_incoming is False


def test_more_trusted_incoming_supersedes() -> None:
    res = resolve_single_valued(
        lane=AuthorityClass.identity,
        existing=FactCandidate("Max", SourceCategory.inference),
        incoming=FactCandidate("Alex", SourceCategory.observation),
    )
    assert res.conflict is True
    assert res.write_incoming is True
    assert res.supersede_existing is True


def test_less_trusted_incoming_rejected() -> None:
    res = resolve_single_valued(
        lane=AuthorityClass.identity,
        existing=FactCandidate("Alex", SourceCategory.observation),
        incoming=FactCandidate("Max", SourceCategory.inference),
    )
    assert res.conflict is True
    assert res.write_incoming is False
    assert res.supersede_existing is False
