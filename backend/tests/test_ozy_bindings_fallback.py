"""Tests for the dev-only ozy_bindings fallback module."""

from __future__ import annotations

import json

from app.services.ozy_bindings_fallback import (
    allocate_token_budget,
    check_circuit_breaker,
    check_payload_sensitivity,
    check_provenance,
    check_tainted_action,
    compute_taint,
    detect_conflicts,
    evaluate_decay,
    filter_claims,
    resolve_approval,
    validate_audit_entry,
    validate_schema,
)


def test_filter_claims_returns_all_claims() -> None:
    payload = json.dumps({"claims": [{"id": "c1"}, {"id": "c2"}]})
    result = json.loads(filter_claims(payload))
    assert result["allowed"] == [{"id": "c1"}, {"id": "c2"}]
    assert result["filtered_count"] == 0
    assert result["filter_reasons"] == []


def test_filter_claims_empty() -> None:
    payload = json.dumps({})
    result = json.loads(filter_claims(payload))
    assert result["allowed"] == []


def test_check_payload_sensitivity_returns_allowed() -> None:
    result = json.loads(check_payload_sensitivity(json.dumps({"sensitivity": "S2"})))
    assert result == "Allowed"


def test_validate_schema_returns_schema_valid() -> None:
    result = json.loads(validate_schema(json.dumps({"field": "value"})))
    assert result == "SchemaValid"


def test_check_provenance_user_explicit() -> None:
    payload = json.dumps({"source_type": "user_explicit"})
    result = json.loads(check_provenance(payload))
    assert result["auto_confirm_eligible"] is True
    assert result["locked_to_tentative"] is True


def test_check_provenance_model_inferred() -> None:
    payload = json.dumps({"source_type": "model_inferred"})
    result = json.loads(check_provenance(payload))
    assert result["auto_confirm_eligible"] is False
    assert result["locked_to_tentative"] is True


def test_check_provenance_user_confirmed() -> None:
    payload = json.dumps({"source_type": "user_confirmed"})
    result = json.loads(check_provenance(payload))
    assert result["auto_confirm_eligible"] is False
    assert result["locked_to_tentative"] is False


def test_detect_conflicts_returns_no_conflict() -> None:
    result = json.loads(detect_conflicts(json.dumps({}), json.dumps([])))
    assert result["result"] == "NoConflict"
    assert result["matched_claim_id"] is None


def test_resolve_approval_returns_approved() -> None:
    result = json.loads(resolve_approval(json.dumps({})))
    assert result == "Approved"


def test_compute_taint_no_chunks() -> None:
    payload = json.dumps({"chunks": []})
    result = json.loads(compute_taint(payload))
    assert result["effective_trust"] == "T2"
    assert result["effective_sensitivity"] == "S0"
    assert result["is_tainted"] is False
    assert result["taint_sources"] == []


def test_compute_taint_with_chunks() -> None:
    payload = json.dumps(
        {
            "chunks": [
                {"sensitivity": "S1"},
                {"sensitivity": "S3"},
                {"sensitivity": "S2"},
            ]
        }
    )
    result = json.loads(compute_taint(payload))
    assert result["effective_sensitivity"] == "S3"


def test_compute_taint_unknown_sensitivity_defaults_s0() -> None:
    payload = json.dumps({"chunks": [{"sensitivity": "UNKNOWN"}]})
    result = json.loads(compute_taint(payload))
    assert result["effective_sensitivity"] == "S0"


def test_check_tainted_action_returns_proceed() -> None:
    result = json.loads(check_tainted_action(json.dumps({})))
    assert result == "Proceed"


def test_validate_audit_entry_returns_valid() -> None:
    result = json.loads(validate_audit_entry(json.dumps({})))
    assert result == "Valid"


def test_evaluate_decay_without_claims_returns_no_actions() -> None:
    result = json.loads(evaluate_decay(json.dumps([]), "2026-01-01T00:00:00Z"))
    assert result == []


def test_evaluate_decay_answers_one_action_per_claim() -> None:
    """Callers pair claims and actions by position and refuse a mismatch.

    A short list would turn the nightly decay run into an error rather than the
    no-op this fallback is meant to be.
    """
    claims = json.dumps([{"source_ref": "turn-1"}, {"source_ref": "turn-1"}, {}])
    result = json.loads(evaluate_decay(claims, "2026-01-01T00:00:00Z"))
    assert result == [
        {"claim_ref": "turn-1", "action": "Keep"},
        {"claim_ref": "turn-1", "action": "Keep"},
        {"claim_ref": "", "action": "Keep"},
    ]


def test_evaluate_decay_survives_a_payload_that_is_not_a_list() -> None:
    result = json.loads(evaluate_decay(json.dumps({"claims": []}), "2026-01-01T00:00:00Z"))
    assert result == []


def test_check_circuit_breaker_returns_allow() -> None:
    result = json.loads(
        check_circuit_breaker(
            config_json=json.dumps({}),
            current_count=5,
            status_json=json.dumps({}),
            seconds_since_last_trip=None,
        )
    )
    assert result == "Allow"


def test_allocate_token_budget_zero_claims() -> None:
    payload = json.dumps({"available_tokens": 1000, "claims_count": 0})
    result = json.loads(allocate_token_budget(payload))
    assert result["max_claims"] == 0
    assert result["max_tokens_per_claim"] == 0
    assert result["truncation_needed"] is False


def test_allocate_token_budget_nonzero_claims() -> None:
    payload = json.dumps({"available_tokens": 1000, "claims_count": 4})
    result = json.loads(allocate_token_budget(payload))
    assert result["max_claims"] == 4
    assert result["max_tokens_per_claim"] == 250
    assert result["truncation_needed"] is False


def test_allocate_token_budget_minimum_per_claim() -> None:
    payload = json.dumps({"available_tokens": 0, "claims_count": 5})
    result = json.loads(allocate_token_budget(payload))
    assert result["max_tokens_per_claim"] == 1
