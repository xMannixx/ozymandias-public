use ozy_contracts::{ConflictGroupData, ConflictGroupStatus, OzyError};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, from_str, json, to_string};

fn assert_roundtrip<T>(value: &T)
where
    T: Serialize + DeserializeOwned + PartialEq + std::fmt::Debug,
{
    let json = to_string(value).expect("serialize");
    let back: T = from_str(&json).expect("deserialize");
    assert_eq!(&back, value);
}

#[test]
fn schema_validation_roundtrip() {
    assert_roundtrip(&OzyError::SchemaValidation {
        message: "schema invalid".to_owned(),
    });
}

#[test]
fn sensitivity_violation_roundtrip() {
    assert_roundtrip(&OzyError::SensitivityViolation {
        message: "s4 blocked".to_owned(),
    });
}

#[test]
fn approval_denied_roundtrip() {
    assert_roundtrip(&OzyError::ApprovalDenied {
        message: "approval denied".to_owned(),
    });
}

#[test]
fn conflict_detected_roundtrip() {
    assert_roundtrip(&OzyError::ConflictDetected {
        group: ConflictGroupData {
            group_id: "group-7".to_owned(),
            claim_ids: vec!["c1".to_owned(), "c2".to_owned()],
            status: ConflictGroupStatus::Pending,
        },
    });
}

#[test]
fn circuit_breaker_tripped_roundtrip() {
    assert_roundtrip(&OzyError::CircuitBreakerTripped {
        message: "rate limit".to_owned(),
    });
}

#[test]
fn token_budget_exceeded_roundtrip() {
    assert_roundtrip(&OzyError::TokenBudgetExceeded);
}

#[test]
fn taint_propagation_roundtrip() {
    assert_roundtrip(&OzyError::TaintPropagation {
        message: "taint escalated".to_owned(),
    });
}

#[test]
fn invariant_violation_roundtrip() {
    assert_roundtrip(&OzyError::InvariantViolation {
        message: "invariant failed".to_owned(),
    });
}

#[test]
fn payload_sensitivity_leak_roundtrip() {
    assert_roundtrip(&OzyError::PayloadSensitivityLeak {
        message: "possible leak".to_owned(),
    });
}

#[test]
fn ozy_error_uses_type_tag_and_detail_content_for_struct_variant() {
    let err = OzyError::SchemaValidation {
        message: "x".to_owned(),
    };
    let value: Value = serde_json::to_value(err).expect("to value");
    assert_eq!(value["type"], json!("SchemaValidation"));
    assert_eq!(value["detail"]["message"], json!("x"));
}

#[test]
fn ozy_error_uses_type_tag_without_detail_for_unit_variant() {
    let err = OzyError::TokenBudgetExceeded;
    let value: Value = serde_json::to_value(err).expect("to value");
    assert_eq!(value["type"], json!("TokenBudgetExceeded"));
    assert_eq!(value.get("detail"), None);
}

#[test]
fn ozy_error_rejects_unknown_type_tag() {
    let bad_json = r#"{"type":"NotAnError","detail":{"message":"x"}}"#;
    let parsed: Result<OzyError, _> = from_str(bad_json);
    assert!(parsed.is_err());
}

#[test]
fn golden_schema_validation_json_is_stable() {
    let err = OzyError::SchemaValidation {
        message: "schema invalid".to_owned(),
    };
    let json = to_string(&err).expect("serialize");
    assert_eq!(
        json,
        r#"{"type":"SchemaValidation","detail":{"message":"schema invalid"}}"#
    );
}

#[test]
fn golden_token_budget_json_is_stable() {
    let err = OzyError::TokenBudgetExceeded;
    let json = to_string(&err).expect("serialize");
    assert_eq!(json, r#"{"type":"TokenBudgetExceeded"}"#);
}
