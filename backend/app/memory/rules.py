"""Behavioral (procedural) rule matching and conflict detection.

Self-written rules are the highest-risk memory: a bad rule changes future
behavior. All decisions here are pure and deterministic so the human review
gate can rely on stable, explainable verdicts.

Trigger/effect shape (JSON):
- trigger: ``{"keywords": ["..."], "domain": "..."}``
- effect:  ``{"action": "use_markdown", "polarity": "affirm" | "negate"}``
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.memory.text_norm import query_terms, stem

DEFAULT_DOMAIN_RULE_CAP = 5
DEFAULT_GLOBAL_RULE_CAP = 20
DEFAULT_DOMAIN_ARTIFACT_BUDGET = 10
RuleJson = dict[str, Any]


@dataclass(frozen=True)
class RuleSpec:
    """Minimal projection of a behavioral rule for deterministic reasoning."""

    id: str
    domain: str
    trigger: RuleJson
    effect: RuleJson
    artifact_cost: int = 1


@dataclass(frozen=True)
class RuleConflict:
    """A detected conflict against an existing rule or a budget/cap."""

    conflict_type: str  # direct | interaction | budget | cap
    severity: str  # hard | soft
    detail: str
    other_rule_id: str | None = None


def _trigger_terms(trigger: RuleJson) -> set[str]:
    keywords = trigger.get("keywords", []) if isinstance(trigger, dict) else []
    terms: set[str] = set()
    for keyword in keywords:
        terms.update(query_terms(str(keyword)))
    return terms


def triggers_overlap(left: RuleJson, right: RuleJson) -> bool:
    """Return ``True`` if two triggers share at least one stemmed keyword."""
    return bool(_trigger_terms(left) & _trigger_terms(right))


def is_triggered(trigger: RuleJson, query: str) -> bool:
    """Return ``True`` if the query activates this trigger."""
    terms = _trigger_terms(trigger)
    if not terms:
        return False
    return bool(terms & query_terms(query))


def _action(effect: RuleJson) -> str | None:
    if not isinstance(effect, dict):
        return None
    action = effect.get("action")
    return stem(str(action)) if action is not None else None


def _polarity(effect: RuleJson) -> str:
    if not isinstance(effect, dict):
        return "affirm"
    return str(effect.get("polarity", "affirm"))


def detect_conflicts(
    proposed: RuleSpec,
    active: list[RuleSpec],
    *,
    domain_rule_cap: int = DEFAULT_DOMAIN_RULE_CAP,
    global_rule_cap: int = DEFAULT_GLOBAL_RULE_CAP,
    domain_artifact_budget: int = DEFAULT_DOMAIN_ARTIFACT_BUDGET,
) -> list[RuleConflict]:
    """Detect direct, interaction, budget and cap conflicts for a proposal."""
    conflicts: list[RuleConflict] = []
    same_domain = [r for r in active if r.domain == proposed.domain]

    proposed_action = _action(proposed.effect)
    for rule in active:
        if not triggers_overlap(proposed.trigger, rule.trigger):
            continue
        rule_action = _action(rule.effect)
        if (
            proposed_action is not None
            and proposed_action == rule_action
            and _polarity(proposed.effect) != _polarity(rule.effect)
        ):
            conflicts.append(
                RuleConflict(
                    conflict_type="direct",
                    severity="hard",
                    detail=(
                        f"directly contradicts rule {rule.id}: same action "
                        f"'{rule_action}' with opposite polarity on overlapping trigger"
                    ),
                    other_rule_id=rule.id,
                )
            )
        else:
            conflicts.append(
                RuleConflict(
                    conflict_type="interaction",
                    severity="soft",
                    detail=(f"overlapping trigger with rule {rule.id}; behaviors may interact"),
                    other_rule_id=rule.id,
                )
            )

    if len(same_domain) >= domain_rule_cap:
        conflicts.append(
            RuleConflict(
                conflict_type="cap",
                severity="hard",
                detail=(
                    f"domain '{proposed.domain}' already has {len(same_domain)} active "
                    f"rules (cap {domain_rule_cap})"
                ),
            )
        )
    if len(active) >= global_rule_cap:
        conflicts.append(
            RuleConflict(
                conflict_type="cap",
                severity="hard",
                detail=f"global active rule cap reached ({len(active)}/{global_rule_cap})",
            )
        )

    domain_artifacts = sum(r.artifact_cost for r in same_domain) + proposed.artifact_cost
    if domain_artifacts > domain_artifact_budget:
        conflicts.append(
            RuleConflict(
                conflict_type="budget",
                severity="soft",
                detail=(
                    f"domain '{proposed.domain}' artifact budget exceeded "
                    f"({domain_artifacts}/{domain_artifact_budget})"
                ),
            )
        )
    return conflicts


def has_hard_conflict(conflicts: list[RuleConflict]) -> bool:
    """Return ``True`` if any conflict is hard (blocks without override)."""
    return any(conflict.severity == "hard" for conflict in conflicts)
