"""Tests for behavioral rule matching and conflict detection."""

from app.memory.rules import (
    RuleSpec,
    detect_conflicts,
    has_hard_conflict,
    is_triggered,
    triggers_overlap,
)


def _rule(
    rid: str,
    keywords: list[str],
    action: str,
    polarity: str = "affirm",
    domain: str = "format",
) -> RuleSpec:
    return RuleSpec(
        id=rid,
        domain=domain,
        trigger={"keywords": keywords},
        effect={"action": action, "polarity": polarity},
    )


def test_is_triggered_matches_keyword() -> None:
    assert is_triggered({"keywords": ["code"]}, "Schreib mir Code dafür")


def test_is_triggered_no_match() -> None:
    assert not is_triggered({"keywords": ["code"]}, "Wie ist das Wetter?")


def test_triggers_overlap() -> None:
    assert triggers_overlap({"keywords": ["code"]}, {"keywords": ["code", "test"]})
    assert not triggers_overlap({"keywords": ["code"]}, {"keywords": ["wetter"]})


def test_direct_contradiction_is_hard() -> None:
    proposed = _rule("p", ["code"], "use_markdown", polarity="negate")
    active = [_rule("a", ["code"], "use_markdown", polarity="affirm")]
    conflicts = detect_conflicts(proposed, active)
    assert has_hard_conflict(conflicts)
    assert any(c.conflict_type == "direct" for c in conflicts)


def test_interaction_is_soft() -> None:
    proposed = _rule("p", ["code"], "add_comments")
    active = [_rule("a", ["code"], "use_markdown")]
    conflicts = detect_conflicts(proposed, active)
    assert not has_hard_conflict(conflicts)
    assert any(c.conflict_type == "interaction" for c in conflicts)


def test_domain_cap_is_hard() -> None:
    proposed = _rule("p", ["xyz"], "a")
    active = [_rule(f"a{i}", ["nomatch"], f"x{i}") for i in range(5)]
    conflicts = detect_conflicts(proposed, active, domain_rule_cap=5)
    assert any(c.conflict_type == "cap" and c.severity == "hard" for c in conflicts)


def test_artifact_budget_is_soft() -> None:
    proposed = RuleSpec("p", "format", {"keywords": ["zz"]}, {"action": "a"}, artifact_cost=11)
    conflicts = detect_conflicts(proposed, [], domain_artifact_budget=10)
    assert any(c.conflict_type == "budget" for c in conflicts)
