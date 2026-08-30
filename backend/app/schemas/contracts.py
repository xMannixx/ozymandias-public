"""Pydantic contracts mirroring `ozy-contracts` JSON payloads."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

U32_MAX = 4_294_967_295
U64_MAX = 18_446_744_073_709_551_615


class _Contract(BaseModel):
    """Base for every payload that crosses the Rust boundary.

    Unknown fields are refused on purpose. Serde and Pydantic both ignore them by
    default, so a field added on one side only would disappear in silence — for a
    governance payload that means losing a flag instead of seeing a mismatch. The
    Rust structs deny unknown fields for the same reason.
    """

    model_config = ConfigDict(extra="forbid")


class Sensitivity(StrEnum):
    S0 = "S0"
    S1 = "S1"
    S2 = "S2"
    S3 = "S3"
    S4 = "S4"


class TrustLevel(StrEnum):
    T0 = "T0"
    T1 = "T1"
    T2 = "T2"
    T3 = "T3"


class AuthorityLevel(StrEnum):
    A0 = "A0"
    A1 = "A1"
    A2 = "A2"


class HandlingPolicy(StrEnum):
    cloud_ok_encrypted = "cloud_ok_encrypted"
    local_preferred = "local_preferred"
    local_only = "local_only"
    s4_isolated = "s4_isolated"


class VerificationState(StrEnum):
    tentative = "tentative"
    confirmed = "confirmed"
    superseded = "superseded"
    retracted = "retracted"


class Lifecycle(StrEnum):
    session = "session"
    temporary = "temporary"
    permanent = "permanent"
    expiry = "expiry"


class SourceType(StrEnum):
    user_explicit = "user_explicit"
    model_inferred = "model_inferred"
    connector_data = "connector_data"
    user_confirmed = "user_confirmed"


class ConflictGroupStatus(StrEnum):
    pending = "pending"
    resolved = "resolved"


class ApprovalClass(StrEnum):
    class0 = "class0"
    class1 = "class1"
    class2 = "class2"
    class3 = "class3"
    class4 = "class4"


class AuditEventType(StrEnum):
    turn_processed = "turn_processed"
    memory_confirmed = "memory_confirmed"
    memory_rejected = "memory_rejected"
    memory_superseded = "memory_superseded"
    memory_retracted = "memory_retracted"
    action_executed = "action_executed"
    action_blocked = "action_blocked"
    action_rolled_back = "action_rolled_back"
    sensitivity_violation = "sensitivity_violation"
    circuit_breaker_tripped = "circuit_breaker_tripped"
    payload_sensitivity_warning = "payload_sensitivity_warning"
    taint_escalation = "taint_escalation"
    security_event = "security_event"
    manual_override = "manual_override"


class AuditResult(StrEnum):
    success = "success"
    failed = "failed"
    blocked = "blocked"
    rolled_back = "rolled_back"


class Channel(StrEnum):
    web = "web"
    telegram = "telegram"
    system = "system"
    celery = "celery"


class AuthorityClass(StrEnum):
    """Memory lane a claim belongs to, each with its own lifecycle and policy."""

    identity = "identity"
    preference = "preference"
    evidence = "evidence"
    authorization = "authorization"
    procedural = "procedural"


class MessageDetail(_Contract):
    message: str


class ClaimData(_Contract):
    """Mirror of the Rust `ClaimData`, field for field.

    `memory_type` stays a free string on both sides because the column is TEXT and
    Rust maps unknown values to `MemoryType::Other` instead of rejecting them;
    which values it knows by name is defined there, not mirrored in a second list.
    """

    subject: str
    attribute: str | None = None
    value: str
    content: str
    memory_type: str
    authority_class: AuthorityClass = AuthorityClass.evidence
    sensitivity: Sensitivity
    trust_level: TrustLevel
    handling_policy: HandlingPolicy
    verification_state: VerificationState
    confidence: float
    source_type: SourceType
    source_ref: str | None = None
    user_locked: bool
    decay_eligible: bool
    lifecycle: Lifecycle
    valid_from: str | None = None
    valid_to: str | None = None

    @field_validator("memory_type")
    @classmethod
    def validate_memory_type(cls, value: str) -> str:
        """Reject only an empty value.

        The set is deliberately open: a new memory type should not need a schema
        change on both sides of the bridge before it can be stored.
        """
        if not value:
            raise ValueError("memory_type must be a non-empty string")
        return value


class ProposalData(_Contract):
    proposed_claim: ClaimData
    source_ref: str | None = None
    source_type: SourceType


class ConflictGroupData(_Contract):
    group_id: str
    claim_ids: list[str]
    status: ConflictGroupStatus


class WriteGateInput(_Contract):
    proposal: ProposalData


class G1ResultSchemaErrorPayload(_Contract):
    errors: list[str]


class G1ResultSchemaErrorVariant(_Contract):
    SchemaError: G1ResultSchemaErrorPayload


G1Result = Literal["SchemaValid"] | G1ResultSchemaErrorVariant


class G2Result(_Contract):
    auto_confirm_eligible: bool
    locked_to_tentative: bool


class ConflictResultConflictGroupPayload(_Contract):
    claim_ids: list[str]


class ConflictResultConflictGroupVariant(_Contract):
    ConflictGroup: ConflictResultConflictGroupPayload


ConflictResult = Literal["NoConflict", "TemporalSuccession"] | ConflictResultConflictGroupVariant


class G3Result(_Contract):
    result: ConflictResult
    matched_claim_id: str | None = None


class FilterReasonSensitivityTooHighPayload(_Contract):
    claim_sensitivity: Sensitivity
    max_allowed: Sensitivity


class FilterReasonSensitivityTooHighVariant(_Contract):
    SensitivityTooHigh: FilterReasonSensitivityTooHighPayload


class FilterReasonIntentMismatchPayload(_Contract):
    claim_sensitivity: Sensitivity
    intent_type: str


class FilterReasonIntentMismatchVariant(_Contract):
    IntentMismatch: FilterReasonIntentMismatchPayload


FilterReason = (
    Literal["ProviderNotLocal", "ProviderNotEncrypted"]
    | FilterReasonSensitivityTooHighVariant
    | FilterReasonIntentMismatchVariant
)


class SensitivityFilterInput(_Contract):
    claims: list[ClaimData]
    intent_type: str
    provider_is_local: bool
    provider_is_encrypted: bool
    allow_s3_cloud_fallback: bool = False


class SensitivityFilterOutput(_Contract):
    allowed: list[ClaimData]
    filtered_count: int = Field(ge=0, le=U32_MAX)
    filter_reasons: list[FilterReason]


class PayloadSensitivityInput(_Contract):
    action_class: ApprovalClass
    payload_sensitivity: Sensitivity
    target_channel: Channel


class PayloadSensitivityWarningPayload(_Contract):
    message: str


class PayloadSensitivityWarningVariant(_Contract):
    Warning: PayloadSensitivityWarningPayload


class PayloadSensitivityEscalatedPayload(_Contract):
    new_class: ApprovalClass


class PayloadSensitivityEscalatedVariant(_Contract):
    Escalated: PayloadSensitivityEscalatedPayload


PayloadSensitivityResult = (
    Literal["Allowed"] | PayloadSensitivityWarningVariant | PayloadSensitivityEscalatedVariant
)


class ApprovalRequest(_Contract):
    action_type: str
    approval_class: ApprovalClass
    payload_preview: str | None = None
    authority_level: AuthorityLevel
    payload_sensitivity: Sensitivity | None = None


class ApprovalDecisionDeniedPayload(_Contract):
    reason: str


class ApprovalDecisionDeniedVariant(_Contract):
    Denied: ApprovalDecisionDeniedPayload


class ApprovalDecisionEscalatedToPayload(_Contract):
    new_class: ApprovalClass


class ApprovalDecisionEscalatedToVariant(_Contract):
    EscalatedTo: ApprovalDecisionEscalatedToPayload


ApprovalDecision = (
    Literal["Approved"] | ApprovalDecisionDeniedVariant | ApprovalDecisionEscalatedToVariant
)


class TaintChunk(_Contract):
    chunk_id: str
    trust_level: TrustLevel
    sensitivity: Sensitivity
    source_type: SourceType


class TaintContext(_Contract):
    chunks: list[TaintChunk]


class TaintSummary(_Contract):
    effective_trust: TrustLevel
    effective_sensitivity: Sensitivity
    is_tainted: bool
    taint_sources: list[str]


class TaintActionCheck(_Contract):
    taint_summary: TaintSummary
    proposed_class: ApprovalClass


class TaintDecisionEscalatePayload(_Contract):
    new_class: ApprovalClass
    reason: str


class TaintDecisionEscalateVariant(_Contract):
    Escalate: TaintDecisionEscalatePayload


class TaintDecisionBlockPayload(_Contract):
    reason: str


class TaintDecisionBlockVariant(_Contract):
    Block: TaintDecisionBlockPayload


TaintDecision = Literal["Proceed"] | TaintDecisionEscalateVariant | TaintDecisionBlockVariant


class AuditEntry(_Contract):
    event_type: AuditEventType
    result: AuditResult
    actor: str
    target_id: str
    detail: str
    timestamp: str
    sensitivity: Sensitivity
    channel: Channel
    payload: str | None = None
    source_ref: str | None = None


class AuditValidationInvalidPayload(_Contract):
    errors: list[str]
    warnings: list[str]


class AuditValidationInvalidVariant(_Contract):
    Invalid: AuditValidationInvalidPayload


AuditValidationResult = Literal["Valid"] | AuditValidationInvalidVariant


class CircuitBreakerConfig(_Contract):
    max_actions_per_window: int = Field(ge=0, le=U32_MAX)
    window_seconds: int = Field(ge=0, le=U64_MAX)
    cooldown_seconds: int = Field(ge=0, le=U64_MAX)


class CircuitBreakerStatusTrippedPayload(_Contract):
    reason: str


class CircuitBreakerStatusTrippedVariant(_Contract):
    Tripped: CircuitBreakerStatusTrippedPayload


CircuitBreakerStatus = Literal["Open", "Closed"] | CircuitBreakerStatusTrippedVariant


class CircuitBreakerDecisionTripPayload(_Contract):
    reason: str


class CircuitBreakerDecisionTripVariant(_Contract):
    Trip: CircuitBreakerDecisionTripPayload


class CircuitBreakerDecisionCooldownPayload(_Contract):
    remaining_seconds: int = Field(ge=0, le=U64_MAX)


class CircuitBreakerDecisionCooldownVariant(_Contract):
    CooldownActive: CircuitBreakerDecisionCooldownPayload


CircuitBreakerDecision = (
    Literal["Allow"] | CircuitBreakerDecisionTripVariant | CircuitBreakerDecisionCooldownVariant
)


class TokenBudgetRequest(_Contract):
    intent_type: str
    available_tokens: int = Field(ge=0, le=U32_MAX)
    claims_count: int = Field(ge=0, le=U32_MAX)


class TokenBudgetAllocation(_Contract):
    max_claims: int = Field(ge=0, le=U32_MAX)
    max_tokens_per_claim: int = Field(ge=0, le=U32_MAX)
    truncation_needed: bool


class DecayActionTypeReduceConfidencePayload(_Contract):
    new_confidence: float


class DecayActionTypeReduceConfidenceVariant(_Contract):
    ReduceConfidence: DecayActionTypeReduceConfidencePayload


DecayActionType = Literal["Keep", "Expire", "Archive"] | DecayActionTypeReduceConfidenceVariant


class DecayAction(_Contract):
    claim_ref: str
    action: DecayActionType


class OzyErrorConflictDetectedDetail(_Contract):
    group: ConflictGroupData


class OzyErrorTokenBudgetExceededDetail(_Contract):
    pass


class OzyErrorSchemaValidation(_Contract):
    type: Literal["SchemaValidation"]
    detail: MessageDetail


class OzyErrorSensitivityViolation(_Contract):
    type: Literal["SensitivityViolation"]
    detail: MessageDetail


class OzyErrorApprovalDenied(_Contract):
    type: Literal["ApprovalDenied"]
    detail: MessageDetail


class OzyErrorConflictDetected(_Contract):
    type: Literal["ConflictDetected"]
    detail: OzyErrorConflictDetectedDetail


class OzyErrorCircuitBreakerTripped(_Contract):
    type: Literal["CircuitBreakerTripped"]
    detail: MessageDetail


class OzyErrorTokenBudgetExceeded(_Contract):
    type: Literal["TokenBudgetExceeded"]
    detail: OzyErrorTokenBudgetExceededDetail | None = None


class OzyErrorTaintPropagation(_Contract):
    type: Literal["TaintPropagation"]
    detail: MessageDetail


class OzyErrorInvariantViolation(_Contract):
    type: Literal["InvariantViolation"]
    detail: MessageDetail


class OzyErrorPayloadSensitivityLeak(_Contract):
    type: Literal["PayloadSensitivityLeak"]
    detail: MessageDetail


OzyErrorPayload = (
    OzyErrorSchemaValidation
    | OzyErrorSensitivityViolation
    | OzyErrorApprovalDenied
    | OzyErrorConflictDetected
    | OzyErrorCircuitBreakerTripped
    | OzyErrorTokenBudgetExceeded
    | OzyErrorTaintPropagation
    | OzyErrorInvariantViolation
    | OzyErrorPayloadSensitivityLeak
)
