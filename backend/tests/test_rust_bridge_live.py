"""Every binding once, against the compiled core.

The rest of the suite runs against `ozy_bindings_fallback`, which parses nothing —
so nothing there would notice if a Pydantic model and its Rust struct stopped
agreeing. These tests only run where the wheel is installed (the `bindings-smoke`
job in CI) and are the place where `deny_unknown_fields` and `extra="forbid"`
actually bite: a field added on one side only fails here.
"""

from __future__ import annotations

import importlib
import importlib.util
import json
import os

import pytest

from app.schemas import (
    ApprovalClass,
    ApprovalRequest,
    AuditEntry,
    AuditEventType,
    AuditResult,
    AuthorityLevel,
    Channel,
    CircuitBreakerConfig,
    ClaimData,
    HandlingPolicy,
    Lifecycle,
    PayloadSensitivityInput,
    ProposalData,
    Sensitivity,
    SensitivityFilterInput,
    SourceType,
    TaintActionCheck,
    TaintChunk,
    TaintContext,
    TaintSummary,
    TokenBudgetRequest,
    TrustLevel,
    VerificationState,
    WriteGateInput,
)
from app.schemas.contracts import AuthorityClass
from app.services import rust_bridge

if os.environ.get("OZY_REQUIRE_RUST_BINDINGS") == "1":
    importlib.import_module("ozy_bindings")

pytestmark = pytest.mark.skipif(
    importlib.util.find_spec("ozy_bindings") is None,
    reason="compiled ozy_bindings not installed",
)


def _claim() -> ClaimData:
    """A claim with every field set, so no field can hide behind a default."""
    return ClaimData(
        subject="user:42",
        attribute="city",
        value="Berlin",
        content="User lives in Berlin",
        memory_type="profile",
        authority_class=AuthorityClass.identity,
        sensitivity=Sensitivity.S1,
        trust_level=TrustLevel.T2,
        handling_policy=HandlingPolicy.local_preferred,
        verification_state=VerificationState.tentative,
        confidence=0.8,
        source_type=SourceType.user_explicit,
        source_ref="turn:1",
        user_locked=False,
        decay_eligible=True,
        lifecycle=Lifecycle.temporary,
        valid_from="2026-01-01T00:00:00Z",
        valid_to="2026-06-01T00:00:00Z",
    )


def _proposal() -> ProposalData:
    return ProposalData(
        proposed_claim=_claim(),
        source_ref="turn:1",
        source_type=SourceType.user_explicit,
    )


def _taint_summary() -> TaintSummary:
    return TaintSummary(
        effective_trust=TrustLevel.T1,
        effective_sensitivity=Sensitivity.S2,
        is_tainted=True,
        taint_sources=["chunk-1"],
    )


def test_the_real_bindings_are_loaded() -> None:
    """Guard the guard: if the fallback answered here, the rest proves nothing."""
    assert rust_bridge._load_bindings() is importlib.import_module("ozy_bindings")


def test_filter_claims() -> None:
    output = rust_bridge.filter_claims(
        SensitivityFilterInput(
            claims=[_claim()],
            intent_type="summarize",
            provider_is_local=True,
            provider_is_encrypted=True,
            allow_s3_cloud_fallback=False,
        )
    )
    assert output.allowed[0].authority_class == AuthorityClass.identity
    assert output.filtered_count == 0


def test_check_payload_sensitivity() -> None:
    result = rust_bridge.check_payload_sensitivity(
        PayloadSensitivityInput(
            action_class=ApprovalClass.class2,
            payload_sensitivity=Sensitivity.S2,
            target_channel=Channel.web,
        )
    )
    assert result is not None


def test_validate_schema() -> None:
    result = rust_bridge.validate_schema(WriteGateInput(proposal=_proposal()))
    assert result == "SchemaValid"


def test_check_provenance() -> None:
    result = rust_bridge.check_provenance(_proposal())
    assert result.auto_confirm_eligible is True


def test_detect_conflicts() -> None:
    result = rust_bridge.detect_conflicts(_proposal(), [_claim()])
    assert result.result is not None


def test_resolve_approval() -> None:
    decision = rust_bridge.resolve_approval(
        ApprovalRequest(
            action_type="send_message",
            approval_class=ApprovalClass.class2,
            payload_preview="hello",
            authority_level=AuthorityLevel.A1,
            payload_sensitivity=Sensitivity.S2,
        )
    )
    assert decision is not None


def test_compute_taint() -> None:
    summary = rust_bridge.compute_taint(
        TaintContext(
            chunks=[
                TaintChunk(
                    chunk_id="chunk-1",
                    trust_level=TrustLevel.T1,
                    sensitivity=Sensitivity.S2,
                    source_type=SourceType.model_inferred,
                )
            ]
        )
    )
    assert summary.effective_sensitivity == Sensitivity.S2


def test_check_tainted_action() -> None:
    decision = rust_bridge.check_tainted_action(
        TaintActionCheck(taint_summary=_taint_summary(), proposed_class=ApprovalClass.class2)
    )
    assert decision is not None


def test_validate_audit_entry() -> None:
    result = rust_bridge.validate_audit_entry(
        AuditEntry(
            event_type=AuditEventType.action_executed,
            result=AuditResult.success,
            actor="system:test",
            target_id="claim:1",
            detail="validated",
            timestamp="2026-04-04T12:34:56Z",
            sensitivity=Sensitivity.S0,
            channel=Channel.system,
            payload='{"k":"v"}',
            source_ref="source-1",
        )
    )
    assert result == "Valid"


def test_evaluate_decay() -> None:
    actions = rust_bridge.evaluate_decay([_claim(), _claim()], "2026-04-04T12:34:56Z")
    assert len(actions) == 2


def test_check_circuit_breaker() -> None:
    decision = rust_bridge.check_circuit_breaker(
        CircuitBreakerConfig(max_actions_per_window=10, window_seconds=60, cooldown_seconds=60),
        0,
        "Open",
        None,
    )
    assert decision == "Allow"


def test_allocate_token_budget() -> None:
    allocation = rust_bridge.allocate_token_budget(
        TokenBudgetRequest(intent_type="analyze", available_tokens=1000, claims_count=10)
    )
    assert allocation.max_claims == 10
    assert allocation.max_tokens_per_claim == 100


def test_a_field_python_alone_knows_is_rejected() -> None:
    """The point of deny_unknown_fields: silence would mean a lost flag."""
    payload = _claim().model_dump(mode="json")
    payload["priority"] = 3

    with pytest.raises(rust_bridge.OzyRustError):
        rust_bridge._call_binding(
            "evaluate_decay",
            json.dumps([payload]),
            "2026-04-04T12:34:56Z",
        )


@pytest.mark.parametrize("sensitivity", [Sensitivity.S3, Sensitivity.S4])
def test_sensitive_claims_are_filtered_for_cloud(sensitivity: Sensitivity) -> None:
    claim = _claim().model_copy(update={"sensitivity": sensitivity})
    result = rust_bridge.filter_claims(
        SensitivityFilterInput(
            claims=[claim],
            intent_type="summarize",
            provider_is_local=False,
            provider_is_encrypted=True,
        )
    )
    assert result.allowed == []
    assert result.filtered_count == 1
    assert len(result.filter_reasons) == 1


def test_untrusted_taint_blocks_mutation() -> None:
    summary = rust_bridge.compute_taint(
        TaintContext(
            chunks=[
                TaintChunk(
                    chunk_id="external",
                    trust_level=TrustLevel.T0,
                    sensitivity=Sensitivity.S1,
                    source_type=SourceType.connector_data,
                )
            ]
        )
    )
    assert summary.is_tainted is True
    assert summary.taint_sources == ["external"]
    decision = rust_bridge.check_tainted_action(
        TaintActionCheck(taint_summary=summary, proposed_class=ApprovalClass.class2)
    )
    assert not isinstance(decision, str)
    assert "Block" in decision.model_dump()


def test_sensitive_approval_escalates() -> None:
    decision = rust_bridge.resolve_approval(
        ApprovalRequest(
            action_type="send_message",
            approval_class=ApprovalClass.class1,
            authority_level=AuthorityLevel.A1,
            payload_sensitivity=Sensitivity.S4,
        )
    )
    assert not isinstance(decision, str)
    assert decision.model_dump() == {"EscalatedTo": {"new_class": "class4"}}


def test_real_rust_error_preserves_payload_and_cause() -> None:
    with pytest.raises(rust_bridge.OzyRustError) as caught:
        rust_bridge.allocate_token_budget(
            TokenBudgetRequest(intent_type="analyze", available_tokens=0, claims_count=1)
        )
    payload = caught.value.payload
    assert payload is not None
    assert payload.type == "InvariantViolation"
    assert isinstance(caught.value.__cause__, ValueError)


def test_circuit_breaker_tagged_states_and_unsigned_limits() -> None:
    from app.schemas.contracts import CircuitBreakerStatusTrippedVariant

    config = CircuitBreakerConfig(
        max_actions_per_window=2**32 - 1,
        window_seconds=60,
        cooldown_seconds=2**64 - 1,
    )
    trip = rust_bridge.check_circuit_breaker(config, 2**32 - 1, "Open")
    assert not isinstance(trip, str)
    assert "Trip" in trip.model_dump()
    state = CircuitBreakerStatusTrippedVariant.model_validate({"Tripped": {"reason": "limit"}})
    cooldown = rust_bridge.check_circuit_breaker(config, 0, state)
    assert not isinstance(cooldown, str)
    assert cooldown.model_dump() == {"CooldownActive": {"remaining_seconds": 2**64 - 1}}
    assert rust_bridge.check_circuit_breaker(config, 0, "Closed", 2**64 - 1) == "Allow"
