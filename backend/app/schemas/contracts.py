"""Pydantic contracts mirroring `ozy-contracts` JSON payloads."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, field_validator

U32_MAX = 4_294_967_295
U64_MAX = 18_446_744_073_709_551_615


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


class MessageDetail(BaseModel):
    message: str


class ClaimData(BaseModel):
    """Mirror of the Rust `ClaimData`, plus what only Python needs.

    `authority_class` has no counterpart in Rust: lanes are decided in
    `app.memory.lanes`, and serde drops the field on the way in. `memory_type`
    stays a free string here because the column is TEXT and Rust maps unknown
    values to `MemoryType::Other` instead of rejecting them; which values it
    knows by name is defined there, not mirrored in a second list.
    """

    subject: str
    attribute: str | None = None
    value: str
    content: str
    memory_type: str
    authority_class: str = "evidence"
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


class ProposalData(BaseModel):
    proposed_claim: ClaimData
    source_ref: str | None = None
    source_type: SourceType


class ConflictGroupData(BaseModel):
    group_id: str
    claim_ids: list[str]
    status: ConflictGroupStatus


class WriteGateInput(BaseModel):
    proposal: ProposalData


class G1ResultSchemaErrorPayload(BaseModel):
    errors: list[str]


class G1ResultSchemaErrorVariant(BaseModel):
    SchemaError: G1ResultSchemaErrorPayload


G1Result = Literal["SchemaValid"] | G1ResultSchemaErrorVariant


class G2Result(BaseModel):
    auto_confirm_eligible: bool
    locked_to_tentative: bool


class ConflictResultConflictGroupPayload(BaseModel):
    claim_ids: list[str]


class ConflictResultConflictGroupVariant(BaseModel):
    ConflictGroup: ConflictResultConflictGroupPayload


ConflictResult = Literal["NoConflict", "TemporalSuccession"] | ConflictResultConflictGroupVariant


class G3Result(BaseModel):
    result: ConflictResult
    matched_claim_id: str | None = None


class FilterReasonSensitivityTooHighPayload(BaseModel):
    claim_sensitivity: Sensitivity
    max_allowed: Sensitivity


class FilterReasonSensitivityTooHighVariant(BaseModel):
    SensitivityTooHigh: FilterReasonSensitivityTooHighPayload


class FilterReasonIntentMismatchPayload(BaseModel):
    claim_sensitivity: Sensitivity
    intent_type: str


class FilterReasonIntentMismatchVariant(BaseModel):
    IntentMismatch: FilterReasonIntentMismatchPayload


FilterReason = (
    Literal["ProviderNotLocal", "ProviderNotEncrypted"]
    | FilterReasonSensitivityTooHighVariant
    | FilterReasonIntentMismatchVariant
)


class SensitivityFilterInput(BaseModel):
    claims: list[ClaimData]
    intent_type: str
    provider_is_local: bool
    provider_is_encrypted: bool
    allow_s3_cloud_fallback: bool = False


class SensitivityFilterOutput(BaseModel):
    allowed: list[ClaimData]
    filtered_count: int = Field(ge=0, le=U32_MAX)
    filter_reasons: list[FilterReason]


class PayloadSensitivityInput(BaseModel):
    action_class: ApprovalClass
    payload_sensitivity: Sensitivity
    target_channel: Channel


class PayloadSensitivityWarningPayload(BaseModel):
    message: str


class PayloadSensitivityWarningVariant(BaseModel):
    Warning: PayloadSensitivityWarningPayload


class PayloadSensitivityEscalatedPayload(BaseModel):
    new_class: ApprovalClass


class PayloadSensitivityEscalatedVariant(BaseModel):
    Escalated: PayloadSensitivityEscalatedPayload


PayloadSensitivityResult = (
    Literal["Allowed"] | PayloadSensitivityWarningVariant | PayloadSensitivityEscalatedVariant
)


class ApprovalRequest(BaseModel):
    action_type: str
    approval_class: ApprovalClass
    payload_preview: str | None = None
    authority_level: AuthorityLevel
    payload_sensitivity: Sensitivity | None = None


class ApprovalDecisionDeniedPayload(BaseModel):
    reason: str


class ApprovalDecisionDeniedVariant(BaseModel):
    Denied: ApprovalDecisionDeniedPayload


class ApprovalDecisionEscalatedToPayload(BaseModel):
    new_class: ApprovalClass


class ApprovalDecisionEscalatedToVariant(BaseModel):
    EscalatedTo: ApprovalDecisionEscalatedToPayload


ApprovalDecision = (
    Literal["Approved"] | ApprovalDecisionDeniedVariant | ApprovalDecisionEscalatedToVariant
)


class TaintChunk(BaseModel):
    chunk_id: str
    trust_level: TrustLevel
    sensitivity: Sensitivity
    source_type: SourceType


class TaintContext(BaseModel):
    chunks: list[TaintChunk]


class TaintSummary(BaseModel):
    effective_trust: TrustLevel
    effective_sensitivity: Sensitivity
    is_tainted: bool
    taint_sources: list[str]


class TaintActionCheck(BaseModel):
    taint_summary: TaintSummary
    proposed_class: ApprovalClass


class TaintDecisionEscalatePayload(BaseModel):
    new_class: ApprovalClass
    reason: str


class TaintDecisionEscalateVariant(BaseModel):
    Escalate: TaintDecisionEscalatePayload


class TaintDecisionBlockPayload(BaseModel):
    reason: str


class TaintDecisionBlockVariant(BaseModel):
    Block: TaintDecisionBlockPayload


TaintDecision = Literal["Proceed"] | TaintDecisionEscalateVariant | TaintDecisionBlockVariant


class AuditEntry(BaseModel):
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


class AuditValidationInvalidPayload(BaseModel):
    errors: list[str]
    warnings: list[str]


class AuditValidationInvalidVariant(BaseModel):
    Invalid: AuditValidationInvalidPayload


AuditValidationResult = Literal["Valid"] | AuditValidationInvalidVariant


class CircuitBreakerConfig(BaseModel):
    max_actions_per_window: int = Field(ge=0, le=U32_MAX)
    window_seconds: int = Field(ge=0, le=U64_MAX)
    cooldown_seconds: int = Field(ge=0, le=U64_MAX)


class CircuitBreakerStatusTrippedPayload(BaseModel):
    reason: str


class CircuitBreakerStatusTrippedVariant(BaseModel):
    Tripped: CircuitBreakerStatusTrippedPayload


CircuitBreakerStatus = Literal["Open", "Closed"] | CircuitBreakerStatusTrippedVariant


class CircuitBreakerDecisionTripPayload(BaseModel):
    reason: str


class CircuitBreakerDecisionTripVariant(BaseModel):
    Trip: CircuitBreakerDecisionTripPayload


class CircuitBreakerDecisionCooldownPayload(BaseModel):
    remaining_seconds: int = Field(ge=0, le=U64_MAX)


class CircuitBreakerDecisionCooldownVariant(BaseModel):
    CooldownActive: CircuitBreakerDecisionCooldownPayload


CircuitBreakerDecision = (
    Literal["Allow"] | CircuitBreakerDecisionTripVariant | CircuitBreakerDecisionCooldownVariant
)


class TokenBudgetRequest(BaseModel):
    intent_type: str
    available_tokens: int = Field(ge=0, le=U32_MAX)
    claims_count: int = Field(ge=0, le=U32_MAX)


class TokenBudgetAllocation(BaseModel):
    max_claims: int = Field(ge=0, le=U32_MAX)
    max_tokens_per_claim: int = Field(ge=0, le=U32_MAX)
    truncation_needed: bool


class DecayActionTypeReduceConfidencePayload(BaseModel):
    new_confidence: float


class DecayActionTypeReduceConfidenceVariant(BaseModel):
    ReduceConfidence: DecayActionTypeReduceConfidencePayload


DecayActionType = Literal["Keep", "Expire", "Archive"] | DecayActionTypeReduceConfidenceVariant


class DecayAction(BaseModel):
    claim_ref: str
    action: DecayActionType


class OzyErrorConflictDetectedDetail(BaseModel):
    group: ConflictGroupData


class OzyErrorTokenBudgetExceededDetail(BaseModel):
    pass


class OzyErrorSchemaValidation(BaseModel):
    type: Literal["SchemaValidation"]
    detail: MessageDetail


class OzyErrorSensitivityViolation(BaseModel):
    type: Literal["SensitivityViolation"]
    detail: MessageDetail


class OzyErrorApprovalDenied(BaseModel):
    type: Literal["ApprovalDenied"]
    detail: MessageDetail


class OzyErrorConflictDetected(BaseModel):
    type: Literal["ConflictDetected"]
    detail: OzyErrorConflictDetectedDetail


class OzyErrorCircuitBreakerTripped(BaseModel):
    type: Literal["CircuitBreakerTripped"]
    detail: MessageDetail


class OzyErrorTokenBudgetExceeded(BaseModel):
    type: Literal["TokenBudgetExceeded"]
    detail: OzyErrorTokenBudgetExceededDetail | None = None


class OzyErrorTaintPropagation(BaseModel):
    type: Literal["TaintPropagation"]
    detail: MessageDetail


class OzyErrorInvariantViolation(BaseModel):
    type: Literal["InvariantViolation"]
    detail: MessageDetail


class OzyErrorPayloadSensitivityLeak(BaseModel):
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
