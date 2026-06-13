use ozy_contracts::{
    ApprovalClass, ApprovalDecision, CircuitBreakerDecision, CircuitBreakerStatus, ConflictResult,
    DecayActionType, FilterReason, G1Result, PayloadSensitivityResult, Sensitivity,
};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, from_str, to_string};

fn assert_roundtrip<T>(value: &T)
where
    T: Serialize + DeserializeOwned + PartialEq + std::fmt::Debug,
{
    let json = to_string(value).expect("serialize");
    let back: T = from_str(&json).expect("deserialize");
    assert_eq!(&back, value);
}

#[test]
fn conflict_result_no_conflict_roundtrip() {
    assert_roundtrip(&ConflictResult::NoConflict);
}

#[test]
fn conflict_result_temporal_succession_roundtrip() {
    assert_roundtrip(&ConflictResult::TemporalSuccession);
}

#[test]
fn conflict_result_conflict_group_roundtrip() {
    assert_roundtrip(&ConflictResult::ConflictGroup {
        claim_ids: vec!["c1".to_owned(), "c2".to_owned()],
    });
}

#[test]
fn filter_reason_sensitivity_too_high_roundtrip() {
    assert_roundtrip(&FilterReason::SensitivityTooHigh {
        claim_sensitivity: Sensitivity::S4,
        max_allowed: Sensitivity::S2,
    });
}

#[test]
fn filter_reason_provider_not_local_roundtrip() {
    assert_roundtrip(&FilterReason::ProviderNotLocal);
}

#[test]
fn filter_reason_provider_not_encrypted_roundtrip() {
    assert_roundtrip(&FilterReason::ProviderNotEncrypted);
}

#[test]
fn filter_reason_intent_mismatch_roundtrip() {
    assert_roundtrip(&FilterReason::IntentMismatch {
        claim_sensitivity: Sensitivity::S3,
        intent_type: "broadcast".to_owned(),
    });
}

#[test]
fn g1_result_schema_valid_roundtrip() {
    assert_roundtrip(&G1Result::SchemaValid);
}

#[test]
fn g1_result_schema_error_roundtrip() {
    assert_roundtrip(&G1Result::SchemaError {
        errors: vec!["subject missing".to_owned(), "value empty".to_owned()],
    });
}

#[test]
fn payload_result_allowed_roundtrip() {
    assert_roundtrip(&PayloadSensitivityResult::Allowed);
}

#[test]
fn payload_result_warning_roundtrip() {
    assert_roundtrip(&PayloadSensitivityResult::Warning {
        message: "possible privacy leak".to_owned(),
    });
}

#[test]
fn payload_result_escalated_roundtrip() {
    assert_roundtrip(&PayloadSensitivityResult::Escalated {
        new_class: ApprovalClass::Class4,
    });
}

#[test]
fn circuit_breaker_open_roundtrip() {
    assert_roundtrip(&CircuitBreakerStatus::Open);
}

#[test]
fn circuit_breaker_closed_roundtrip() {
    assert_roundtrip(&CircuitBreakerStatus::Closed);
}

#[test]
fn circuit_breaker_tripped_roundtrip() {
    assert_roundtrip(&CircuitBreakerStatus::Tripped {
        reason: "rate exceeded".to_owned(),
    });
}

#[test]
fn circuit_breaker_decision_roundtrip() {
    assert_roundtrip(&CircuitBreakerDecision::Allow);
    assert_roundtrip(&CircuitBreakerDecision::Trip {
        reason: "limit exceeded".to_owned(),
    });
    assert_roundtrip(&CircuitBreakerDecision::CooldownActive {
        remaining_seconds: 45,
    });
}

#[test]
fn approval_decision_approved_roundtrip() {
    assert_roundtrip(&ApprovalDecision::Approved);
}

#[test]
fn approval_decision_denied_roundtrip() {
    assert_roundtrip(&ApprovalDecision::Denied {
        reason: "insufficient authority".to_owned(),
    });
}

#[test]
fn approval_decision_escalated_to_roundtrip() {
    assert_roundtrip(&ApprovalDecision::EscalatedTo {
        new_class: ApprovalClass::Class3,
    });
}

#[test]
fn filter_reason_shape_contains_variant_name() {
    let value = FilterReason::ProviderNotEncrypted;
    let json: Value = serde_json::to_value(value).expect("to value");
    match json {
        Value::String(name) => assert_eq!(name, "ProviderNotEncrypted"),
        _ => panic!("expected string enum representation"),
    }
}

#[test]
fn payload_sensitivity_result_warning_shape_contains_message() {
    let value = PayloadSensitivityResult::Warning {
        message: "warn".to_owned(),
    };
    let json: Value = serde_json::to_value(value).expect("to value");
    let text = json.to_string();
    assert!(text.contains("Warning"));
    assert!(text.contains("message"));
    assert!(text.contains("warn"));
}

#[test]
fn decay_action_type_roundtrip() {
    assert_roundtrip(&DecayActionType::Keep);
    assert_roundtrip(&DecayActionType::Expire);
    assert_roundtrip(&DecayActionType::Archive);
    assert_roundtrip(&DecayActionType::ReduceConfidence {
        new_confidence: 0.63,
    });
}
