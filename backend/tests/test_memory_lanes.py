"""Tests for authority lanes and source-write policy."""

from app.memory.lanes import (
    AuthorityClass,
    SourceCategory,
    check_write_policy,
    is_more_trusted,
    policy_for,
    source_category_from_type,
)


def test_all_lanes_have_policy() -> None:
    for lane in AuthorityClass:
        policy = policy_for(lane)
        assert 0.0 <= policy.min_confidence <= 1.0
        assert policy.allowed_sources


def test_tool_and_external_quarantined_to_evidence() -> None:
    for lane in AuthorityClass:
        policy = policy_for(lane)
        if lane != AuthorityClass.evidence:
            assert SourceCategory.tool not in policy.allowed_sources
            assert SourceCategory.external not in policy.allowed_sources


def test_external_cannot_write_identity() -> None:
    result = check_write_policy(
        lane=AuthorityClass.identity, source=SourceCategory.external, confidence=0.99
    )
    assert result.allowed is False
    assert "not allowed" in (result.reason or "")


def test_external_can_write_evidence() -> None:
    result = check_write_policy(
        lane=AuthorityClass.evidence, source=SourceCategory.external, confidence=0.8
    )
    assert result.allowed is True


def test_confidence_floor_enforced() -> None:
    result = check_write_policy(
        lane=AuthorityClass.identity,
        source=SourceCategory.observation,
        confidence=0.5,
    )
    assert result.allowed is False
    assert "floor" in (result.reason or "")


def test_authorization_not_injectable() -> None:
    assert policy_for(AuthorityClass.authorization).injectable is False


def test_single_valued_lanes() -> None:
    assert policy_for(AuthorityClass.identity).single_valued is True
    assert policy_for(AuthorityClass.authorization).single_valued is True
    assert policy_for(AuthorityClass.evidence).single_valued is False


def test_unknown_source_type_falls_back_to_external() -> None:
    assert source_category_from_type("totally_unknown") == SourceCategory.external


def test_source_type_mapping() -> None:
    assert source_category_from_type("user_explicit") == SourceCategory.observation
    assert source_category_from_type("model_inferred") == SourceCategory.inference
    assert source_category_from_type("connector_data") == SourceCategory.external


def test_trust_ordering() -> None:
    assert is_more_trusted(SourceCategory.observation, SourceCategory.external)
    assert not is_more_trusted(SourceCategory.external, SourceCategory.observation)
