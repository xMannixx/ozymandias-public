//! Top-level error contracts for Ozy Rust modules.

use crate::structs::ConflictGroupData;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "detail")]
pub enum OzyError {
    SchemaValidation { message: String },
    SensitivityViolation { message: String },
    ApprovalDenied { message: String },
    ConflictDetected { group: ConflictGroupData },
    CircuitBreakerTripped { message: String },
    TokenBudgetExceeded,
    TaintPropagation { message: String },
    InvariantViolation { message: String },
    PayloadSensitivityLeak { message: String },
}

#[cfg(test)]
mod tests {
    use super::OzyError;
    use crate::enums::ConflictGroupStatus;
    use crate::structs::ConflictGroupData;
    use serde::{Deserialize, Serialize};
    use serde_json::{from_str, to_string};

    fn roundtrip_json<T>(value: &T) -> T
    where
        T: Serialize + for<'de> Deserialize<'de> + PartialEq + std::fmt::Debug,
    {
        let json = to_string(value).expect("serialize to JSON");
        from_str(&json).expect("deserialize from JSON")
    }

    #[test]
    fn unit_error_variant_roundtrip() {
        let err = OzyError::TokenBudgetExceeded;
        assert_eq!(roundtrip_json(&err), err);
    }

    #[test]
    fn message_error_variants_roundtrip() {
        let schema = OzyError::SchemaValidation {
            message: "invalid schema".to_owned(),
        };
        assert_eq!(roundtrip_json(&schema), schema);

        let sensitivity = OzyError::SensitivityViolation {
            message: "payload too sensitive".to_owned(),
        };
        assert_eq!(roundtrip_json(&sensitivity), sensitivity);
    }

    #[test]
    fn nested_conflict_error_roundtrip() {
        let conflict = OzyError::ConflictDetected {
            group: ConflictGroupData {
                group_id: "cg-1".to_owned(),
                claim_ids: vec!["c-1".to_owned(), "c-2".to_owned()],
                status: ConflictGroupStatus::Pending,
            },
        };
        assert_eq!(roundtrip_json(&conflict), conflict);
    }
}
