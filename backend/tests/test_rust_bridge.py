"""Rust bridge tests."""

import json
from typing import Any

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
    TaintContext,
    TaintSummary,
    TokenBudgetRequest,
    TrustLevel,
    VerificationState,
    WriteGateInput,
)
from app.services import rust_bridge
from app.services.rust_bridge import OzyRustError


def _sample_claim() -> ClaimData:
    return ClaimData(
        subject="user:42",
        attribute="city",
        value="Berlin",
        content="User lives in Berlin",
        memory_type="profile",
        sensitivity=Sensitivity.S1,
        trust_level=TrustLevel.T2,
        handling_policy=HandlingPolicy.local_preferred,
        verification_state=VerificationState.tentative,
        confidence=0.8,
        source_type=SourceType.user_explicit,
        source_ref="turn-1",
        user_locked=False,
        decay_eligible=True,
        lifecycle=Lifecycle.temporary,
        valid_from=None,
        valid_to=None,
    )


def _sample_proposal() -> ProposalData:
    return ProposalData(
        proposed_claim=_sample_claim(),
        source_ref="turn-1",
        source_type=SourceType.user_explicit,
    )


def _sample_audit_entry() -> AuditEntry:
    return AuditEntry(
        event_type=AuditEventType.action_executed,
        result=AuditResult.success,
        actor="system:runner",
        target_id="claim-1",
        detail="executed safely",
        timestamp="2026-04-04T12:34:56Z",
        sensitivity=Sensitivity.S1,
        channel=Channel.system,
        payload=None,
        source_ref="turn-1",
    )


class FakeBindings:
    def filter_claims(self, json_input: str) -> str:
        payload = json.loads(json_input)
        return json.dumps(
            {
                "allowed": payload["claims"],
                "filtered_count": 0,
                "filter_reasons": [],
            }
        )

    def check_payload_sensitivity(self, _json_input: str) -> str:
        return json.dumps("Allowed")

    def validate_schema(self, _json_input: str) -> str:
        return json.dumps("SchemaValid")

    def check_provenance(self, _json_input: str) -> str:
        return json.dumps({"auto_confirm_eligible": True, "locked_to_tentative": False})

    def detect_conflicts(self, _proposal_json: str, existing_claims_json: str) -> str:
        claims = json.loads(existing_claims_json)
        if claims:
            return json.dumps(
                {
                    "result": {"ConflictGroup": {"claim_ids": ["c-1", "c-2"]}},
                    "matched_claim_id": "c-1",
                }
            )
        return json.dumps({"result": "NoConflict", "matched_claim_id": None})

    def resolve_approval(self, _json_input: str) -> str:
        return json.dumps("Approved")

    def compute_taint(self, _json_input: str) -> str:
        return json.dumps(
            {
                "effective_trust": "T3",
                "effective_sensitivity": "S1",
                "is_tainted": False,
                "taint_sources": [],
            }
        )

    def check_tainted_action(self, _json_input: str) -> str:
        return json.dumps("Proceed")

    def validate_audit_entry(self, _json_input: str) -> str:
        return json.dumps("Valid")

    def evaluate_decay(self, claims_json: str, _now: str) -> str:
        claims = json.loads(claims_json)
        return json.dumps([{"claim_ref": claims[0]["subject"], "action": "Expire"}])

    def check_circuit_breaker(
        self,
        _config_json: str,
        _current_count: int,
        _status_json: str,
        _seconds_since_last_trip: int | None,
    ) -> str:
        return json.dumps("Allow")

    def allocate_token_budget(self, _json_input: str) -> str:
        return json.dumps(
            {"max_claims": 10, "max_tokens_per_claim": 100, "truncation_needed": False}
        )


def _patch_bindings(monkeypatch: pytest.MonkeyPatch, module: Any) -> None:
    monkeypatch.setattr("app.services.rust_bridge.importlib.import_module", lambda _name: module)


@pytest.fixture()
def fake_bindings(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_bindings(monkeypatch, FakeBindings())


def test_filter_claims_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.filter_claims(
        SensitivityFilterInput(
            claims=[_sample_claim()],
            intent_type="normal_recall",
            provider_is_local=True,
            provider_is_encrypted=True,
        )
    )
    assert len(result.allowed) == 1
    assert result.filtered_count == 0


def test_check_payload_sensitivity_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.check_payload_sensitivity(
        PayloadSensitivityInput(
            action_class=ApprovalClass.class1,
            payload_sensitivity=Sensitivity.S1,
            target_channel=Channel.web,
        )
    )
    assert result == "Allowed"


def test_validate_schema_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.validate_schema(WriteGateInput(proposal=_sample_proposal()))
    assert result == "SchemaValid"


def test_check_provenance_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.check_provenance(_sample_proposal())
    assert result.auto_confirm_eligible is True
    assert result.locked_to_tentative is False


def test_detect_conflicts_without_existing_claims(fake_bindings: None) -> None:
    result = rust_bridge.detect_conflicts(_sample_proposal(), [])
    assert result.result == "NoConflict"
    assert result.matched_claim_id is None


def test_detect_conflicts_with_existing_claims(fake_bindings: None) -> None:
    result = rust_bridge.detect_conflicts(_sample_proposal(), [_sample_claim()])
    assert result.matched_claim_id == "c-1"
    assert not isinstance(result.result, str)
    assert result.result.ConflictGroup.claim_ids == ["c-1", "c-2"]


def test_resolve_approval_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.resolve_approval(
        ApprovalRequest(
            action_type="send_message",
            approval_class=ApprovalClass.class1,
            payload_preview="preview",
            authority_level=AuthorityLevel.A1,
            payload_sensitivity=Sensitivity.S1,
        )
    )
    assert result == "Approved"


def test_compute_taint_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.compute_taint(TaintContext(chunks=[]))
    assert isinstance(result, TaintSummary)
    assert result.is_tainted is False


def test_check_tainted_action_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.check_tainted_action(
        TaintActionCheck(
            taint_summary=TaintSummary(
                effective_trust=TrustLevel.T3,
                effective_sensitivity=Sensitivity.S1,
                is_tainted=False,
                taint_sources=[],
            ),
            proposed_class=ApprovalClass.class1,
        )
    )
    assert result == "Proceed"


def test_validate_audit_entry_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.validate_audit_entry(_sample_audit_entry())
    assert result == "Valid"


def test_evaluate_decay_roundtrip(fake_bindings: None) -> None:
    claim = _sample_claim()
    result = rust_bridge.evaluate_decay([claim], "2026-04-04T12:34:56Z")
    assert len(result) == 1
    assert result[0].claim_ref == "user:42"


def test_check_circuit_breaker_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.check_circuit_breaker(
        CircuitBreakerConfig(max_actions_per_window=10, window_seconds=60, cooldown_seconds=60),
        0,
        "Open",
        None,
    )
    assert result == "Allow"


def test_allocate_token_budget_roundtrip(fake_bindings: None) -> None:
    result = rust_bridge.allocate_token_budget(
        TokenBudgetRequest(intent_type="analyze", available_tokens=1000, claims_count=10)
    )
    assert result.max_claims == 10
    assert result.max_tokens_per_claim == 100
    assert result.truncation_needed is False


def test_rust_bridge_maps_structured_ozy_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class FailingBindings(FakeBindings):
        def allocate_token_budget(self, _json_input: str) -> str:
            raise ValueError(json.dumps({"type": "TokenBudgetExceeded"}))

    _patch_bindings(monkeypatch, FailingBindings())

    with pytest.raises(OzyRustError) as exc_info:
        rust_bridge.allocate_token_budget(
            TokenBudgetRequest(intent_type="analyze", available_tokens=0, claims_count=10)
        )

    assert exc_info.value.payload is not None
    assert exc_info.value.payload.type == "TokenBudgetExceeded"


def test_rust_bridge_maps_non_json_value_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class FailingBindings(FakeBindings):
        def filter_claims(self, json_input: str) -> str:
            raise ValueError("raw non-json error")

    _patch_bindings(monkeypatch, FailingBindings())

    with pytest.raises(OzyRustError) as exc_info:
        rust_bridge.filter_claims(
            SensitivityFilterInput(
                claims=[_sample_claim()],
                intent_type="normal_recall",
                provider_is_local=True,
                provider_is_encrypted=True,
            )
        )

    assert exc_info.value.payload is None
    assert "raw non-json error" in exc_info.value.message


def test_rust_bridge_maps_unknown_json_value_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class FailingBindings(FakeBindings):
        def validate_schema(self, _json_input: str) -> str:
            raise ValueError(json.dumps({"type": "UnknownRustError", "detail": {"message": "x"}}))

    _patch_bindings(monkeypatch, FailingBindings())

    with pytest.raises(OzyRustError) as exc_info:
        rust_bridge.validate_schema(WriteGateInput(proposal=_sample_proposal()))

    assert exc_info.value.payload is None


@pytest.mark.parametrize("dev_bypass", [False, True])
@pytest.mark.parametrize("under_pytest", [False, True])
def test_missing_bindings_fallback_is_gated(
    monkeypatch: pytest.MonkeyPatch, dev_bypass: bool, under_pytest: bool
) -> None:
    from app.config import Settings

    fallback = FakeBindings()

    def load(name: str) -> Any:
        if name == "ozy_bindings":
            raise ModuleNotFoundError("missing core", name=name)
        assert name == "app.services.ozy_bindings_fallback"
        return fallback

    monkeypatch.setattr(rust_bridge.importlib, "import_module", load)
    monkeypatch.setattr(rust_bridge, "get_settings", lambda: Settings(auth_dev_bypass=dev_bypass))
    if under_pytest:
        monkeypatch.setenv("PYTEST_CURRENT_TEST", "bridge test")
    else:
        monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    if dev_bypass or under_pytest:
        assert rust_bridge._load_bindings() is fallback
    else:
        with pytest.raises(ModuleNotFoundError):
            rust_bridge._load_bindings()


@pytest.mark.parametrize(
    "error",
    [
        ModuleNotFoundError("missing dependency", name="ozy_bindings._native"),
        ImportError("incompatible Python ABI"),
        OSError("missing shared library"),
    ],
)
def test_broken_installed_bindings_never_fall_back(
    monkeypatch: pytest.MonkeyPatch, error: Exception
) -> None:
    from app.config import Settings

    def load(name: str) -> Any:
        assert name == "ozy_bindings"
        raise error

    monkeypatch.setattr(rust_bridge.importlib, "import_module", load)
    monkeypatch.setattr(rust_bridge, "get_settings", lambda: Settings(auth_dev_bypass=True))
    with pytest.raises(type(error)) as caught:
        rust_bridge._load_bindings()
    assert caught.value is error


@pytest.mark.parametrize(
    ("count", "elapsed"),
    [(-1, None), (2**32, None), (0, -1), (0, 2**64), (True, None), (0, 1.5)],
)
def test_circuit_breaker_rejects_invalid_scalar_arguments_before_loading(
    monkeypatch: pytest.MonkeyPatch, count: Any, elapsed: Any
) -> None:
    from pydantic import ValidationError

    def unexpected_load() -> Any:
        pytest.fail("invalid scalar arguments reached the Rust boundary")

    monkeypatch.setattr(rust_bridge, "_load_bindings", unexpected_load)
    with pytest.raises(ValidationError):
        rust_bridge.check_circuit_breaker(
            CircuitBreakerConfig(max_actions_per_window=10, window_seconds=60, cooldown_seconds=60),
            count,
            "Open",
            elapsed,
        )
