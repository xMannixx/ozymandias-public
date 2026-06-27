"""Typed wrappers around ozy_bindings."""

from __future__ import annotations

import importlib
import json
import os
from typing import Any, Protocol, cast

from pydantic import TypeAdapter

from app.config import get_settings
from app.schemas import (
    ApprovalDecision,
    ApprovalRequest,
    AuditEntry,
    AuditValidationResult,
    CircuitBreakerConfig,
    CircuitBreakerDecision,
    CircuitBreakerStatus,
    ClaimData,
    DecayAction,
    G1Result,
    G2Result,
    G3Result,
    PayloadSensitivityInput,
    PayloadSensitivityResult,
    ProposalData,
    SensitivityFilterInput,
    SensitivityFilterOutput,
    TaintActionCheck,
    TaintContext,
    TaintDecision,
    TaintSummary,
    TokenBudgetAllocation,
    TokenBudgetRequest,
    WriteGateInput,
)
from app.schemas.contracts import OzyErrorPayload


class OzyBindingsModule(Protocol):
    """Protocol for imported ozy_bindings module."""

    def filter_claims(self, json_input: str) -> str: ...

    def check_payload_sensitivity(self, json_input: str) -> str: ...

    def validate_schema(self, json_input: str) -> str: ...

    def check_provenance(self, json_input: str) -> str: ...

    def detect_conflicts(self, proposal_json: str, existing_claims_json: str) -> str: ...

    def resolve_approval(self, json_input: str) -> str: ...

    def compute_taint(self, json_input: str) -> str: ...

    def check_tainted_action(self, json_input: str) -> str: ...

    def validate_audit_entry(self, json_input: str) -> str: ...

    def evaluate_decay(self, claims_json: str, now: str) -> str: ...

    def check_circuit_breaker(
        self,
        config_json: str,
        current_count: int,
        status_json: str,
        seconds_since_last_trip: int | None,
    ) -> str: ...

    def allocate_token_budget(self, json_input: str) -> str: ...


class OzyRustError(Exception):
    """Typed Python exception wrapping an Ozy Rust error payload."""

    def __init__(self, message: str, payload: OzyErrorPayload | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.payload = payload


def _load_bindings() -> OzyBindingsModule:
    try:
        module = importlib.import_module("ozy_bindings")
        return cast(OzyBindingsModule, module)
    except ModuleNotFoundError:
        settings = get_settings()
        if settings.auth_dev_bypass or "PYTEST_CURRENT_TEST" in os.environ:
            fallback = importlib.import_module("app.services.ozy_bindings_fallback")
            return cast(OzyBindingsModule, fallback)
        raise


def _parse_binding_error(exc: ValueError) -> OzyRustError:
    raw_message = str(exc)
    try:
        parsed = json.loads(raw_message)
        payload: OzyErrorPayload = TypeAdapter(OzyErrorPayload).validate_python(parsed)
        return OzyRustError(raw_message, payload=payload)
    except json.JSONDecodeError:
        return OzyRustError(raw_message)
    except ValueError:
        return OzyRustError(raw_message)


def _call_binding(name: str, *args: Any) -> str:
    module = _load_bindings()
    binding_fn = getattr(module, name)
    try:
        result = binding_fn(*args)
        return cast(str, result)
    except ValueError as exc:
        raise _parse_binding_error(exc) from exc


def _decode_model(model_type: Any, payload_json: str) -> Any:
    return TypeAdapter(model_type).validate_json(payload_json)


def filter_claims(payload: SensitivityFilterInput) -> SensitivityFilterOutput:
    output_json = _call_binding("filter_claims", payload.model_dump_json())
    return cast(SensitivityFilterOutput, _decode_model(SensitivityFilterOutput, output_json))


def check_payload_sensitivity(payload: PayloadSensitivityInput) -> PayloadSensitivityResult:
    output_json = _call_binding("check_payload_sensitivity", payload.model_dump_json())
    return cast(PayloadSensitivityResult, _decode_model(PayloadSensitivityResult, output_json))


def validate_schema(payload: WriteGateInput) -> G1Result:
    output_json = _call_binding("validate_schema", payload.model_dump_json())
    return cast(G1Result, _decode_model(G1Result, output_json))


def check_provenance(payload: ProposalData) -> G2Result:
    output_json = _call_binding("check_provenance", payload.model_dump_json())
    return cast(G2Result, _decode_model(G2Result, output_json))


def detect_conflicts(proposal: ProposalData, existing_claims: list[ClaimData]) -> G3Result:
    output_json = _call_binding(
        "detect_conflicts",
        proposal.model_dump_json(),
        json.dumps([claim.model_dump(mode="json") for claim in existing_claims]),
    )
    return cast(G3Result, _decode_model(G3Result, output_json))


def resolve_approval(payload: ApprovalRequest) -> ApprovalDecision:
    output_json = _call_binding("resolve_approval", payload.model_dump_json())
    return cast(ApprovalDecision, _decode_model(ApprovalDecision, output_json))


def compute_taint(payload: TaintContext) -> TaintSummary:
    output_json = _call_binding("compute_taint", payload.model_dump_json())
    return cast(TaintSummary, _decode_model(TaintSummary, output_json))


def check_tainted_action(payload: TaintActionCheck) -> TaintDecision:
    output_json = _call_binding("check_tainted_action", payload.model_dump_json())
    return cast(TaintDecision, _decode_model(TaintDecision, output_json))


def validate_audit_entry(payload: AuditEntry) -> AuditValidationResult:
    output_json = _call_binding("validate_audit_entry", payload.model_dump_json())
    return cast(AuditValidationResult, _decode_model(AuditValidationResult, output_json))


def evaluate_decay(claims: list[ClaimData], now: str) -> list[DecayAction]:
    output_json = _call_binding(
        "evaluate_decay",
        json.dumps([claim.model_dump(mode="json") for claim in claims]),
        now,
    )
    return cast(list[DecayAction], _decode_model(list[DecayAction], output_json))


def check_circuit_breaker(
    config: CircuitBreakerConfig,
    current_count: int,
    status: CircuitBreakerStatus,
    seconds_since_last_trip: int | None = None,
) -> CircuitBreakerDecision:
    if isinstance(status, str):
        status_json = json.dumps(status)
    else:
        status_json = status.model_dump_json()
    output_json = _call_binding(
        "check_circuit_breaker",
        config.model_dump_json(),
        current_count,
        status_json,
        seconds_since_last_trip,
    )
    return cast(CircuitBreakerDecision, _decode_model(CircuitBreakerDecision, output_json))


def allocate_token_budget(payload: TokenBudgetRequest) -> TokenBudgetAllocation:
    output_json = _call_binding("allocate_token_budget", payload.model_dump_json())
    return cast(TokenBudgetAllocation, _decode_model(TokenBudgetAllocation, output_json))
