use ozy_contracts::{
    ApprovalClass, ApprovalRequest, AuditEntry, AuditEventType, AuditResult, AuthorityClass,
    AuthorityLevel, Channel, CircuitBreakerConfig, ClaimData, ConflictGroupData,
    ConflictGroupStatus, ConflictResult, DecayAction, DecayActionType, FilterReason, G2Result,
    G3Result, HandlingPolicy, Lifecycle, MemoryType, PayloadSensitivityInput, ProposalData,
    Sensitivity, SensitivityFilterInput, SensitivityFilterOutput, SourceType,
    TokenBudgetAllocation, TokenBudgetRequest, TrustLevel, VerificationState, WriteGateInput,
};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{from_str, to_string};

fn assert_roundtrip<T>(value: &T)
where
    T: Serialize + DeserializeOwned + PartialEq + std::fmt::Debug,
{
    let json = to_string(value).expect("serialize");
    let back: T = from_str(&json).expect("deserialize");
    assert_eq!(&back, value);
}

fn sample_claim() -> ClaimData {
    ClaimData {
        subject: "user:42".to_owned(),
        attribute: Some("city".to_owned()),
        value: "Berlin".to_owned(),
        content: "User lives in Berlin".to_owned(),
        memory_type: MemoryType::Profile,
        authority_class: AuthorityClass::Identity,
        sensitivity: Sensitivity::S1,
        trust_level: TrustLevel::T3,
        handling_policy: HandlingPolicy::LocalPreferred,
        verification_state: VerificationState::Confirmed,
        confidence: 0.95,
        source_type: SourceType::UserExplicit,
        source_ref: Some("turn:99".to_owned()),
        user_locked: true,
        decay_eligible: false,
        lifecycle: Lifecycle::Permanent,
        valid_from: Some("2026-01-01T00:00:00Z".to_owned()),
        valid_to: None,
    }
}

#[test]
fn claim_data_roundtrip() {
    assert_roundtrip(&sample_claim());
}

#[test]
fn claim_data_without_authority_class_defaults_to_evidence() {
    let json = r#"{
        "subject": "user:42",
        "attribute": null,
        "value": "Berlin",
        "content": "User lives in Berlin",
        "memory_type": "profile",
        "sensitivity": "S1",
        "trust_level": "T3",
        "handling_policy": "local_preferred",
        "verification_state": "confirmed",
        "confidence": 0.95,
        "source_type": "user_explicit",
        "source_ref": null,
        "user_locked": false,
        "decay_eligible": true,
        "lifecycle": "permanent",
        "valid_from": null,
        "valid_to": null
    }"#;
    let parsed: ClaimData = from_str(json).expect("a payload predating the field must still parse");
    assert_eq!(parsed.authority_class, AuthorityClass::Evidence);
}

#[test]
fn claim_data_rejects_a_field_it_does_not_know() {
    // Python mirrors this shape by hand. Ignoring an unknown key would drop a
    // governance flag in silence instead of reporting the mismatch.
    let mut payload = to_string(&sample_claim()).expect("serialize");
    payload.pop();
    payload.push_str(r#","priority":3}"#);

    let parsed: Result<ClaimData, _> = from_str(&payload);
    assert!(parsed.is_err(), "unknown field must not be ignored");
}

#[test]
fn proposal_data_roundtrip() {
    let proposal = ProposalData {
        proposed_claim: sample_claim(),
        source_ref: Some("episode:1".to_owned()),
        source_type: SourceType::ConnectorData,
    };
    assert_roundtrip(&proposal);
}

#[test]
fn conflict_group_data_roundtrip() {
    let group = ConflictGroupData {
        group_id: "cg-1".to_owned(),
        claim_ids: vec!["c1".to_owned(), "c2".to_owned()],
        status: ConflictGroupStatus::Pending,
    };
    assert_roundtrip(&group);
}

#[test]
fn write_gate_input_roundtrip() {
    let input = WriteGateInput {
        proposal: ProposalData {
            proposed_claim: sample_claim(),
            source_ref: None,
            source_type: SourceType::ModelInferred,
        },
    };
    assert_roundtrip(&input);
}

#[test]
fn g2_result_roundtrip() {
    let result = G2Result {
        auto_confirm_eligible: true,
        locked_to_tentative: false,
    };
    assert_roundtrip(&result);
}

#[test]
fn g3_result_roundtrip() {
    let result = G3Result {
        result: ConflictResult::TemporalSuccession,
        matched_claim_id: Some("c-old".to_owned()),
    };
    assert_roundtrip(&result);
}

#[test]
fn sensitivity_filter_input_roundtrip() {
    let input = SensitivityFilterInput {
        claims: vec![sample_claim()],
        intent_type: "summarize".to_owned(),
        provider_is_local: true,
        provider_is_encrypted: true,
        allow_s3_cloud_fallback: true,
    };
    assert_roundtrip(&input);
}

#[test]
fn sensitivity_filter_output_roundtrip() {
    let output = SensitivityFilterOutput {
        allowed: vec![],
        filtered_count: 2,
        filter_reasons: vec![
            FilterReason::ProviderNotLocal,
            FilterReason::ProviderNotEncrypted,
        ],
    };
    assert_roundtrip(&output);
}

#[test]
fn payload_sensitivity_input_roundtrip() {
    let input = PayloadSensitivityInput {
        action_class: ApprovalClass::Class3,
        payload_sensitivity: Sensitivity::S3,
        target_channel: Channel::Telegram,
    };
    assert_roundtrip(&input);
}

#[test]
fn approval_request_roundtrip() {
    let request = ApprovalRequest {
        action_type: "send_mail".to_owned(),
        approval_class: ApprovalClass::Class3,
        payload_preview: Some("hello".to_owned()),
        authority_level: AuthorityLevel::A1,
        payload_sensitivity: Some(Sensitivity::S2),
    };
    assert_roundtrip(&request);
}

#[test]
fn audit_entry_roundtrip() {
    let entry = AuditEntry {
        event_type: AuditEventType::ActionExecuted,
        result: AuditResult::Success,
        actor: "system:validator".to_owned(),
        target_id: "claim:1".to_owned(),
        detail: "audit event for action execution".to_owned(),
        timestamp: "2026-04-04T12:34:56Z".to_owned(),
        sensitivity: Sensitivity::S1,
        channel: Channel::System,
        payload: Some("{\"op\":\"write\"}".to_owned()),
        source_ref: Some("ref:1".to_owned()),
    };
    assert_roundtrip(&entry);
}

#[test]
fn circuit_breaker_config_roundtrip() {
    let cfg = CircuitBreakerConfig {
        max_actions_per_window: 15,
        window_seconds: 60,
        cooldown_seconds: 180,
    };
    assert_roundtrip(&cfg);
}

#[test]
fn token_budget_request_roundtrip() {
    let req = TokenBudgetRequest {
        intent_type: "analyze".to_owned(),
        available_tokens: 12_000,
        claims_count: 6,
    };
    assert_roundtrip(&req);
}

#[test]
fn token_budget_allocation_roundtrip() {
    let allocation = TokenBudgetAllocation {
        max_claims: 4,
        max_tokens_per_claim: 600,
        truncation_needed: true,
    };
    assert_roundtrip(&allocation);
}

#[test]
fn decay_action_roundtrip() {
    let action = DecayAction {
        claim_ref: "claim:7".to_owned(),
        action: DecayActionType::ReduceConfidence {
            new_confidence: 0.54,
        },
    };
    assert_roundtrip(&action);
}
