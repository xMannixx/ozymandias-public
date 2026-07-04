use ozy_bindings::{
    allocate_token_budget_json, check_circuit_breaker_json, check_payload_sensitivity_json,
    check_provenance_json, check_tainted_action_json, compute_taint_json, detect_conflicts_json,
    evaluate_decay_json, filter_claims_json, resolve_approval_json, validate_audit_entry_json,
    validate_schema_json,
};
use ozy_contracts::{
    ApprovalClass, ApprovalDecision, ApprovalRequest, AuditEntry, AuditEventType, AuditResult,
    AuditValidationResult, AuthorityLevel, Channel, CircuitBreakerConfig, CircuitBreakerDecision,
    CircuitBreakerStatus, ClaimData, ConflictResult, DecayAction, G1Result, G2Result, G3Result,
    HandlingPolicy, Lifecycle, MemoryType, PayloadSensitivityInput, PayloadSensitivityResult,
    ProposalData, Sensitivity, SensitivityFilterInput, SensitivityFilterOutput, SourceType,
    TaintActionCheck, TaintChunk, TaintContext, TaintDecision, TaintSummary, TokenBudgetAllocation,
    TokenBudgetRequest, TrustLevel, VerificationState, WriteGateInput,
};

fn sample_claim() -> ClaimData {
    ClaimData {
        subject: "user:42".to_owned(),
        attribute: Some("city".to_owned()),
        value: "Berlin".to_owned(),
        content: "User lives in Berlin".to_owned(),
        memory_type: MemoryType::Profile,
        sensitivity: Sensitivity::S1,
        trust_level: TrustLevel::T2,
        handling_policy: HandlingPolicy::LocalPreferred,
        verification_state: VerificationState::Tentative,
        confidence: 0.8,
        source_type: SourceType::UserExplicit,
        source_ref: Some("claim-1".to_owned()),
        user_locked: false,
        decay_eligible: true,
        lifecycle: Lifecycle::Temporary,
        valid_from: None,
        valid_to: None,
    }
}

fn sample_proposal() -> ProposalData {
    ProposalData {
        proposed_claim: sample_claim(),
        source_ref: Some("turn-1".to_owned()),
        source_type: SourceType::UserExplicit,
    }
}

fn sample_audit_entry() -> AuditEntry {
    AuditEntry {
        event_type: AuditEventType::ActionExecuted,
        result: AuditResult::Success,
        actor: "system:runner".to_owned(),
        target_id: "claim-1".to_owned(),
        detail: "executed safely".to_owned(),
        timestamp: "2026-04-04T12:34:56Z".to_owned(),
        sensitivity: Sensitivity::S1,
        channel: Channel::System,
        payload: None,
        source_ref: Some("turn-1".to_owned()),
    }
}

#[test]
fn filter_claims_wrapper_roundtrip() {
    let input = SensitivityFilterInput {
        claims: vec![sample_claim()],
        intent_type: "normal_recall".to_owned(),
        provider_is_local: true,
        provider_is_encrypted: true,
        allow_s3_cloud_fallback: false,
    };
    let input_json = serde_json::to_string(&input).expect("serialize input");
    let output_json = filter_claims_json(&input_json).expect("conversion should succeed");
    let output: SensitivityFilterOutput =
        serde_json::from_str(&output_json).expect("deserialize output");
    assert_eq!(output.allowed.len(), 1);
}

#[test]
fn check_payload_sensitivity_wrapper_roundtrip() {
    let input = PayloadSensitivityInput {
        action_class: ApprovalClass::Class1,
        payload_sensitivity: Sensitivity::S1,
        target_channel: Channel::Web,
    };
    let output_json =
        check_payload_sensitivity_json(&serde_json::to_string(&input).expect("serialize input"))
            .expect("conversion should succeed");
    let output: PayloadSensitivityResult =
        serde_json::from_str(&output_json).expect("deserialize output");
    assert!(matches!(output, PayloadSensitivityResult::Allowed));
}

#[test]
fn validate_schema_wrapper_roundtrip() {
    let input = WriteGateInput {
        proposal: sample_proposal(),
    };
    let output_json =
        validate_schema_json(&serde_json::to_string(&input).expect("serialize input"))
            .expect("conversion should succeed");
    let output: G1Result = serde_json::from_str(&output_json).expect("deserialize output");
    assert!(matches!(output, G1Result::SchemaValid));
}

#[test]
fn check_provenance_wrapper_roundtrip() {
    let output_json =
        check_provenance_json(&serde_json::to_string(&sample_proposal()).expect("serialize input"))
            .expect("conversion should succeed");
    let output: G2Result = serde_json::from_str(&output_json).expect("deserialize output");
    assert!(output.auto_confirm_eligible);
}

#[test]
fn detect_conflicts_wrapper_roundtrip() {
    let proposal_json = serde_json::to_string(&sample_proposal()).expect("serialize proposal");
    let existing_json = serde_json::to_string(&Vec::<ClaimData>::new()).expect("serialize claims");
    let output_json =
        detect_conflicts_json(&proposal_json, &existing_json).expect("conversion should succeed");
    let output: G3Result = serde_json::from_str(&output_json).expect("deserialize output");
    assert!(matches!(output.result, ConflictResult::NoConflict));
}

#[test]
fn resolve_approval_wrapper_roundtrip() {
    let input = ApprovalRequest {
        action_type: "send_message".to_owned(),
        approval_class: ApprovalClass::Class1,
        payload_preview: Some("preview".to_owned()),
        authority_level: AuthorityLevel::A1,
        payload_sensitivity: Some(Sensitivity::S1),
    };
    let output_json =
        resolve_approval_json(&serde_json::to_string(&input).expect("serialize input"))
            .expect("conversion should succeed");
    let output: ApprovalDecision = serde_json::from_str(&output_json).expect("deserialize output");
    assert!(matches!(output, ApprovalDecision::Approved));
}

#[test]
fn compute_taint_wrapper_roundtrip() {
    let input = TaintContext {
        chunks: vec![TaintChunk {
            chunk_id: "chunk-1".to_owned(),
            trust_level: TrustLevel::T3,
            sensitivity: Sensitivity::S1,
            source_type: SourceType::UserExplicit,
        }],
    };
    let output_json = compute_taint_json(&serde_json::to_string(&input).expect("serialize input"))
        .expect("conversion should succeed");
    let output: TaintSummary = serde_json::from_str(&output_json).expect("deserialize output");
    assert!(!output.is_tainted);
}

#[test]
fn check_tainted_action_wrapper_roundtrip() {
    let input = TaintActionCheck {
        taint_summary: TaintSummary {
            effective_trust: TrustLevel::T3,
            effective_sensitivity: Sensitivity::S1,
            is_tainted: false,
            taint_sources: vec![],
        },
        proposed_class: ApprovalClass::Class1,
    };
    let output_json =
        check_tainted_action_json(&serde_json::to_string(&input).expect("serialize input"))
            .expect("conversion should succeed");
    let output: TaintDecision = serde_json::from_str(&output_json).expect("deserialize output");
    assert!(matches!(output, TaintDecision::Proceed));
}

#[test]
fn validate_audit_entry_wrapper_roundtrip() {
    let output_json = validate_audit_entry_json(
        &serde_json::to_string(&sample_audit_entry()).expect("serialize"),
    )
    .expect("conversion should succeed");
    let output: AuditValidationResult =
        serde_json::from_str(&output_json).expect("deserialize output");
    assert!(matches!(output, AuditValidationResult::Valid));
}

#[test]
fn evaluate_decay_wrapper_roundtrip() {
    let claims_json = serde_json::to_string(&vec![sample_claim()]).expect("serialize claims");
    let output_json = evaluate_decay_json(&claims_json, "2026-04-04T12:34:56Z")
        .expect("conversion should succeed");
    let output: Vec<DecayAction> = serde_json::from_str(&output_json).expect("deserialize output");
    assert_eq!(output.len(), 1);
}

#[test]
fn check_circuit_breaker_wrapper_roundtrip() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 10,
        window_seconds: 60,
        cooldown_seconds: 60,
    };
    let config_json = serde_json::to_string(&config).expect("serialize config");
    let status_json = serde_json::to_string(&CircuitBreakerStatus::Open).expect("serialize status");
    let output_json = check_circuit_breaker_json(&config_json, 0, &status_json, None)
        .expect("conversion should succeed");
    let output: CircuitBreakerDecision =
        serde_json::from_str(&output_json).expect("deserialize output");
    assert!(matches!(output, CircuitBreakerDecision::Allow));
}

#[test]
fn allocate_token_budget_wrapper_roundtrip() {
    let input = TokenBudgetRequest {
        intent_type: "analyze".to_owned(),
        available_tokens: 1000,
        claims_count: 10,
    };
    let output_json =
        allocate_token_budget_json(&serde_json::to_string(&input).expect("serialize input"))
            .expect("conversion should succeed");
    let output: TokenBudgetAllocation =
        serde_json::from_str(&output_json).expect("deserialize output");
    assert_eq!(output.max_claims, 10);
    assert_eq!(output.max_tokens_per_claim, 100);
}

#[test]
fn invalid_json_returns_pyerr() {
    let result = filter_claims_json("{");
    assert!(result.is_err());
}

#[test]
fn core_error_is_converted_to_pyerr() {
    let input = TokenBudgetRequest {
        intent_type: "analyze".to_owned(),
        available_tokens: 0,
        claims_count: 10,
    };
    let result =
        allocate_token_budget_json(&serde_json::to_string(&input).expect("serialize input"));
    assert!(result.is_err());
}

#[test]
fn detect_conflicts_invalid_existing_claims_json_returns_pyerr() {
    let proposal_json = serde_json::to_string(&sample_proposal()).expect("serialize proposal");
    let result = detect_conflicts_json(&proposal_json, "{");
    assert!(result.is_err());
}

#[test]
fn evaluate_decay_invalid_now_returns_pyerr() {
    let claims_json = serde_json::to_string(&vec![sample_claim()]).expect("serialize claims");
    let result = evaluate_decay_json(&claims_json, "not-a-timestamp");
    assert!(result.is_err());
}

#[test]
fn check_circuit_breaker_invalid_status_json_returns_pyerr() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 10,
        window_seconds: 60,
        cooldown_seconds: 60,
    };
    let config_json = serde_json::to_string(&config).expect("serialize config");
    let result = check_circuit_breaker_json(&config_json, 0, "{", None);
    assert!(result.is_err());
}

#[test]
fn large_filter_claims_payload_succeeds() {
    let claims = vec![sample_claim(); 50];
    let input = SensitivityFilterInput {
        claims,
        intent_type: "normal_recall".to_owned(),
        provider_is_local: true,
        provider_is_encrypted: true,
        allow_s3_cloud_fallback: false,
    };
    let output_json = filter_claims_json(&serde_json::to_string(&input).expect("serialize input"))
        .expect("conversion should succeed");
    let output: SensitivityFilterOutput =
        serde_json::from_str(&output_json).expect("deserialize output");
    assert_eq!(output.allowed.len(), 50);
}
