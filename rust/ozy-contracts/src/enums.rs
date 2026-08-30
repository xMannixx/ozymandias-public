//! Enumerations from the Ozy contracts specification.

use serde::de::{self, Deserializer, Visitor};
use serde::ser::Serializer;
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Sensitivity {
    #[serde(rename = "S0")]
    S0,
    #[serde(rename = "S1")]
    S1,
    #[serde(rename = "S2")]
    S2,
    #[serde(rename = "S3")]
    S3,
    #[serde(rename = "S4")]
    S4,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TrustLevel {
    #[serde(rename = "T0")]
    T0,
    #[serde(rename = "T1")]
    T1,
    #[serde(rename = "T2")]
    T2,
    #[serde(rename = "T3")]
    T3,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AuthorityLevel {
    #[serde(rename = "A0")]
    A0,
    #[serde(rename = "A1")]
    A1,
    #[serde(rename = "A2")]
    A2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HandlingPolicy {
    CloudOkEncrypted,
    LocalPreferred,
    LocalOnly,
    S4Isolated,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerificationState {
    Tentative,
    Confirmed,
    Superseded,
    Retracted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Lifecycle {
    Session,
    Temporary,
    Permanent,
    Expiry,
}

/// Memory lane a claim belongs to, each with its own lifecycle and write policy.
///
/// Which lane a claim may be written to depends on the trust of its source;
/// today that check lives on the Python side, the claim carries the lane here so
/// the write gates can see it.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthorityClass {
    Identity,
    Preference,
    #[default]
    Evidence,
    Authorization,
    Procedural,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    UserExplicit,
    ModelInferred,
    ConnectorData,
    UserConfirmed,
}

/// Free-form memory class stored as `TEXT` in Postgres.
/// Known values map to typed variants, unknown values map to `Other`.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum MemoryType {
    Profile,
    Health,
    Preference,
    Relationship,
    Event,
    Location,
    Work,
    Finance,
    Security,
    Intimate,
    Other(String),
}

impl MemoryType {
    fn as_db_str(&self) -> &str {
        match self {
            Self::Profile => "profile",
            Self::Health => "health",
            Self::Preference => "preference",
            Self::Relationship => "relationship",
            Self::Event => "event",
            Self::Location => "location",
            Self::Work => "work",
            Self::Finance => "finance",
            Self::Security => "security",
            Self::Intimate => "intimate",
            Self::Other(value) => value.as_str(),
        }
    }

    fn from_db_str(value: &str) -> Self {
        match value {
            "profile" => Self::Profile,
            "health" => Self::Health,
            "preference" => Self::Preference,
            "relationship" => Self::Relationship,
            "event" => Self::Event,
            "location" => Self::Location,
            "work" => Self::Work,
            "finance" => Self::Finance,
            "security" => Self::Security,
            "intimate" => Self::Intimate,
            _ => Self::Other(value.to_owned()),
        }
    }
}

impl Serialize for MemoryType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_db_str())
    }
}

struct MemoryTypeVisitor;

impl<'de> Visitor<'de> for MemoryTypeVisitor {
    type Value = MemoryType;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a memory type string")
    }

    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(MemoryType::from_db_str(value))
    }

    fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        Ok(MemoryType::from_db_str(value.as_str()))
    }
}

impl<'de> Deserialize<'de> for MemoryType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_str(MemoryTypeVisitor)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProposalStatus {
    Pending,
    Confirmed,
    Rejected,
    AutoConfirmed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConflictGroupStatus {
    Pending,
    Resolved,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChangedBy {
    User,
    System,
    DecayJob,
    BatchExtract,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalClass {
    Class0,
    Class1,
    Class2,
    Class3,
    Class4,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ConflictResult {
    NoConflict,
    TemporalSuccession,
    ConflictGroup { claim_ids: Vec<String> },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    TurnProcessed,
    MemoryConfirmed,
    MemoryRejected,
    MemorySuperseded,
    MemoryRetracted,
    ActionExecuted,
    ActionBlocked,
    ActionRolledBack,
    SensitivityViolation,
    CircuitBreakerTripped,
    PayloadSensitivityWarning,
    TaintEscalation,
    SecurityEvent,
    ManualOverride,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditResult {
    Success,
    Failed,
    Blocked,
    RolledBack,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AuditValidationResult {
    Valid,
    Invalid {
        errors: Vec<String>,
        warnings: Vec<String>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Channel {
    Web,
    Telegram,
    System,
    Celery,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleCategory {
    Tone,
    MailBehavior,
    WorkStyle,
    Formatting,
    Security,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum FilterReason {
    SensitivityTooHigh {
        claim_sensitivity: Sensitivity,
        max_allowed: Sensitivity,
    },
    ProviderNotLocal,
    ProviderNotEncrypted,
    IntentMismatch {
        claim_sensitivity: Sensitivity,
        intent_type: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum G1Result {
    SchemaValid,
    SchemaError { errors: Vec<String> },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PayloadSensitivityResult {
    Allowed,
    Warning { message: String },
    Escalated { new_class: ApprovalClass },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CircuitBreakerStatus {
    Open,
    Closed,
    Tripped { reason: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CircuitBreakerDecision {
    Allow,
    Trip { reason: String },
    CooldownActive { remaining_seconds: u64 },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ApprovalDecision {
    Approved,
    Denied { reason: String },
    EscalatedTo { new_class: ApprovalClass },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TaintDecision {
    Proceed,
    Escalate {
        new_class: ApprovalClass,
        reason: String,
    },
    Block {
        reason: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum DecayActionType {
    Keep,
    ReduceConfidence { new_confidence: f64 },
    Expire,
    Archive,
}

#[cfg(test)]
mod tests {
    use super::{
        ApprovalClass, ApprovalDecision, AuditEventType, AuditResult, AuditValidationResult,
        AuthorityLevel, Channel, CircuitBreakerDecision, CircuitBreakerStatus, ConflictResult,
        DecayActionType, FilterReason, G1Result, HandlingPolicy, MemoryType,
        PayloadSensitivityResult, RuleCategory, Sensitivity, SourceType, TaintDecision, TrustLevel,
        VerificationState,
    };
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
    fn fixed_code_enums_have_expected_strings() {
        assert_eq!(to_string(&Sensitivity::S4).expect("serialize"), "\"S4\"");
        assert_eq!(to_string(&TrustLevel::T1).expect("serialize"), "\"T1\"");
        assert_eq!(to_string(&AuthorityLevel::A2).expect("serialize"), "\"A2\"");
    }

    #[test]
    fn snake_case_simple_enums_have_expected_strings() {
        assert_eq!(
            to_string(&HandlingPolicy::CloudOkEncrypted).expect("serialize"),
            "\"cloud_ok_encrypted\""
        );
        assert_eq!(
            to_string(&VerificationState::Tentative).expect("serialize"),
            "\"tentative\""
        );
        assert_eq!(
            to_string(&SourceType::UserExplicit).expect("serialize"),
            "\"user_explicit\""
        );
        assert_eq!(
            to_string(&ApprovalClass::Class3).expect("serialize"),
            "\"class3\""
        );
        assert_eq!(
            to_string(&AuditEventType::MemoryConfirmed).expect("serialize"),
            "\"memory_confirmed\""
        );
        assert_eq!(
            to_string(&AuditResult::RolledBack).expect("serialize"),
            "\"rolled_back\""
        );
        assert_eq!(
            to_string(&AuditEventType::SecurityEvent).expect("serialize"),
            "\"security_event\""
        );
        assert_eq!(
            to_string(&AuditEventType::ManualOverride).expect("serialize"),
            "\"manual_override\""
        );
        assert_eq!(
            to_string(&Channel::Celery).expect("serialize"),
            "\"celery\""
        );
        assert_eq!(
            to_string(&RuleCategory::MailBehavior).expect("serialize"),
            "\"mail_behavior\""
        );
    }

    #[test]
    fn memory_type_supports_known_and_unknown_values() {
        let known = MemoryType::Health;
        assert_eq!(roundtrip_json(&known), known);

        let unknown = MemoryType::Other("future_type".to_owned());
        let json = to_string(&unknown).expect("serialize");
        assert_eq!(json, "\"future_type\"");
        let parsed: MemoryType = from_str(&json).expect("deserialize");
        assert_eq!(parsed, unknown);
    }

    #[test]
    fn payload_enums_roundtrip() {
        let conflict = ConflictResult::ConflictGroup {
            claim_ids: vec!["c1".to_owned(), "c2".to_owned()],
        };
        assert_eq!(roundtrip_json(&conflict), conflict);

        let filter = FilterReason::SensitivityTooHigh {
            claim_sensitivity: Sensitivity::S4,
            max_allowed: Sensitivity::S2,
        };
        assert_eq!(roundtrip_json(&filter), filter);

        let g1 = G1Result::SchemaError {
            errors: vec!["missing field".to_owned()],
        };
        assert_eq!(roundtrip_json(&g1), g1);

        let payload = PayloadSensitivityResult::Escalated {
            new_class: ApprovalClass::Class4,
        };
        assert_eq!(roundtrip_json(&payload), payload);

        let breaker = CircuitBreakerStatus::Tripped {
            reason: "window exceeded".to_owned(),
        };
        assert_eq!(roundtrip_json(&breaker), breaker);

        let breaker_decision = CircuitBreakerDecision::CooldownActive {
            remaining_seconds: 27,
        };
        assert_eq!(roundtrip_json(&breaker_decision), breaker_decision);

        let approval = ApprovalDecision::Denied {
            reason: "insufficient authority".to_owned(),
        };
        assert_eq!(roundtrip_json(&approval), approval);

        let taint = TaintDecision::Escalate {
            new_class: ApprovalClass::Class4,
            reason: "S4 taint detected".to_owned(),
        };
        assert_eq!(roundtrip_json(&taint), taint);

        let audit_validation = AuditValidationResult::Invalid {
            errors: vec!["actor must not be empty".to_owned()],
            warnings: vec!["detail length suspicious for S3+".to_owned()],
        };
        assert_eq!(roundtrip_json(&audit_validation), audit_validation);

        let decay = DecayActionType::ReduceConfidence {
            new_confidence: 0.72,
        };
        assert_eq!(roundtrip_json(&decay), decay);
    }
}
