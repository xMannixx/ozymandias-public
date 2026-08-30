use ozy_contracts::{
    ApprovalClass, AuditEventType, AuditResult, AuthorityClass, AuthorityLevel, ChangedBy, Channel,
    ConflictGroupStatus, DecayActionType, HandlingPolicy, Lifecycle, MemoryType, ProposalStatus,
    Role, RuleCategory, Sensitivity, SourceType, TrustLevel, VerificationState,
};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{from_str, to_string};

fn assert_enum_maps_exactly<T>(value: T, expected_json: &str)
where
    T: Serialize + DeserializeOwned + PartialEq + std::fmt::Debug,
{
    let serialized = to_string(&value).expect("serialize");
    assert_eq!(serialized, expected_json);
    let deserialized: T = from_str(expected_json).expect("deserialize");
    assert_eq!(deserialized, value);
}

macro_rules! enum_case {
    ($name:ident, $ty:ty, $value:expr, $expected:literal) => {
        #[test]
        fn $name() {
            assert_enum_maps_exactly::<$ty>($value, $expected);
        }
    };
}

enum_case!(sensitivity_s0, Sensitivity, Sensitivity::S0, "\"S0\"");
enum_case!(sensitivity_s1, Sensitivity, Sensitivity::S1, "\"S1\"");
enum_case!(sensitivity_s2, Sensitivity, Sensitivity::S2, "\"S2\"");
enum_case!(sensitivity_s3, Sensitivity, Sensitivity::S3, "\"S3\"");
enum_case!(sensitivity_s4, Sensitivity, Sensitivity::S4, "\"S4\"");

enum_case!(trust_t0, TrustLevel, TrustLevel::T0, "\"T0\"");
enum_case!(trust_t1, TrustLevel, TrustLevel::T1, "\"T1\"");
enum_case!(trust_t2, TrustLevel, TrustLevel::T2, "\"T2\"");
enum_case!(trust_t3, TrustLevel, TrustLevel::T3, "\"T3\"");

enum_case!(authority_a0, AuthorityLevel, AuthorityLevel::A0, "\"A0\"");
enum_case!(authority_a1, AuthorityLevel, AuthorityLevel::A1, "\"A1\"");
enum_case!(authority_a2, AuthorityLevel, AuthorityLevel::A2, "\"A2\"");

enum_case!(
    authority_class_identity,
    AuthorityClass,
    AuthorityClass::Identity,
    "\"identity\""
);
enum_case!(
    authority_class_preference,
    AuthorityClass,
    AuthorityClass::Preference,
    "\"preference\""
);
enum_case!(
    authority_class_evidence,
    AuthorityClass,
    AuthorityClass::Evidence,
    "\"evidence\""
);
enum_case!(
    authority_class_authorization,
    AuthorityClass,
    AuthorityClass::Authorization,
    "\"authorization\""
);
enum_case!(
    authority_class_procedural,
    AuthorityClass,
    AuthorityClass::Procedural,
    "\"procedural\""
);

enum_case!(
    handling_cloud_ok_encrypted,
    HandlingPolicy,
    HandlingPolicy::CloudOkEncrypted,
    "\"cloud_ok_encrypted\""
);
enum_case!(
    handling_local_preferred,
    HandlingPolicy,
    HandlingPolicy::LocalPreferred,
    "\"local_preferred\""
);
enum_case!(
    handling_local_only,
    HandlingPolicy,
    HandlingPolicy::LocalOnly,
    "\"local_only\""
);
enum_case!(
    handling_s4_isolated,
    HandlingPolicy,
    HandlingPolicy::S4Isolated,
    "\"s4_isolated\""
);

enum_case!(
    verification_tentative,
    VerificationState,
    VerificationState::Tentative,
    "\"tentative\""
);
enum_case!(
    verification_confirmed,
    VerificationState,
    VerificationState::Confirmed,
    "\"confirmed\""
);
enum_case!(
    verification_superseded,
    VerificationState,
    VerificationState::Superseded,
    "\"superseded\""
);
enum_case!(
    verification_retracted,
    VerificationState,
    VerificationState::Retracted,
    "\"retracted\""
);

enum_case!(
    lifecycle_session,
    Lifecycle,
    Lifecycle::Session,
    "\"session\""
);
enum_case!(
    lifecycle_temporary,
    Lifecycle,
    Lifecycle::Temporary,
    "\"temporary\""
);
enum_case!(
    lifecycle_permanent,
    Lifecycle,
    Lifecycle::Permanent,
    "\"permanent\""
);
enum_case!(lifecycle_expiry, Lifecycle, Lifecycle::Expiry, "\"expiry\"");

enum_case!(
    source_user_explicit,
    SourceType,
    SourceType::UserExplicit,
    "\"user_explicit\""
);
enum_case!(
    source_model_inferred,
    SourceType,
    SourceType::ModelInferred,
    "\"model_inferred\""
);
enum_case!(
    source_connector_data,
    SourceType,
    SourceType::ConnectorData,
    "\"connector_data\""
);
enum_case!(
    source_user_confirmed,
    SourceType,
    SourceType::UserConfirmed,
    "\"user_confirmed\""
);

enum_case!(
    proposal_pending,
    ProposalStatus,
    ProposalStatus::Pending,
    "\"pending\""
);
enum_case!(
    proposal_confirmed,
    ProposalStatus,
    ProposalStatus::Confirmed,
    "\"confirmed\""
);
enum_case!(
    proposal_rejected,
    ProposalStatus,
    ProposalStatus::Rejected,
    "\"rejected\""
);
enum_case!(
    proposal_auto_confirmed,
    ProposalStatus,
    ProposalStatus::AutoConfirmed,
    "\"auto_confirmed\""
);

enum_case!(
    conflict_group_pending,
    ConflictGroupStatus,
    ConflictGroupStatus::Pending,
    "\"pending\""
);
enum_case!(
    conflict_group_resolved,
    ConflictGroupStatus,
    ConflictGroupStatus::Resolved,
    "\"resolved\""
);

enum_case!(changed_by_user, ChangedBy, ChangedBy::User, "\"user\"");
enum_case!(
    changed_by_system,
    ChangedBy,
    ChangedBy::System,
    "\"system\""
);
enum_case!(
    changed_by_decay_job,
    ChangedBy,
    ChangedBy::DecayJob,
    "\"decay_job\""
);
enum_case!(
    changed_by_batch_extract,
    ChangedBy,
    ChangedBy::BatchExtract,
    "\"batch_extract\""
);

enum_case!(
    approval_class0,
    ApprovalClass,
    ApprovalClass::Class0,
    "\"class0\""
);
enum_case!(
    approval_class1,
    ApprovalClass,
    ApprovalClass::Class1,
    "\"class1\""
);
enum_case!(
    approval_class2,
    ApprovalClass,
    ApprovalClass::Class2,
    "\"class2\""
);
enum_case!(
    approval_class3,
    ApprovalClass,
    ApprovalClass::Class3,
    "\"class3\""
);
enum_case!(
    approval_class4,
    ApprovalClass,
    ApprovalClass::Class4,
    "\"class4\""
);

enum_case!(
    audit_turn_processed,
    AuditEventType,
    AuditEventType::TurnProcessed,
    "\"turn_processed\""
);
enum_case!(
    audit_memory_confirmed,
    AuditEventType,
    AuditEventType::MemoryConfirmed,
    "\"memory_confirmed\""
);
enum_case!(
    audit_memory_rejected,
    AuditEventType,
    AuditEventType::MemoryRejected,
    "\"memory_rejected\""
);
enum_case!(
    audit_memory_superseded,
    AuditEventType,
    AuditEventType::MemorySuperseded,
    "\"memory_superseded\""
);
enum_case!(
    audit_memory_retracted,
    AuditEventType,
    AuditEventType::MemoryRetracted,
    "\"memory_retracted\""
);
enum_case!(
    audit_action_executed,
    AuditEventType,
    AuditEventType::ActionExecuted,
    "\"action_executed\""
);
enum_case!(
    audit_action_blocked,
    AuditEventType,
    AuditEventType::ActionBlocked,
    "\"action_blocked\""
);
enum_case!(
    audit_action_rolled_back,
    AuditEventType,
    AuditEventType::ActionRolledBack,
    "\"action_rolled_back\""
);
enum_case!(
    audit_sensitivity_violation,
    AuditEventType,
    AuditEventType::SensitivityViolation,
    "\"sensitivity_violation\""
);
enum_case!(
    audit_circuit_breaker_tripped,
    AuditEventType,
    AuditEventType::CircuitBreakerTripped,
    "\"circuit_breaker_tripped\""
);
enum_case!(
    audit_payload_sensitivity_warning,
    AuditEventType,
    AuditEventType::PayloadSensitivityWarning,
    "\"payload_sensitivity_warning\""
);
enum_case!(
    audit_taint_escalation,
    AuditEventType,
    AuditEventType::TaintEscalation,
    "\"taint_escalation\""
);
enum_case!(
    audit_security_event,
    AuditEventType,
    AuditEventType::SecurityEvent,
    "\"security_event\""
);
enum_case!(
    audit_manual_override,
    AuditEventType,
    AuditEventType::ManualOverride,
    "\"manual_override\""
);

enum_case!(
    audit_result_success,
    AuditResult,
    AuditResult::Success,
    "\"success\""
);
enum_case!(
    audit_result_failed,
    AuditResult,
    AuditResult::Failed,
    "\"failed\""
);
enum_case!(
    audit_result_blocked,
    AuditResult,
    AuditResult::Blocked,
    "\"blocked\""
);
enum_case!(
    audit_result_rolled_back,
    AuditResult,
    AuditResult::RolledBack,
    "\"rolled_back\""
);

enum_case!(
    decay_action_keep,
    DecayActionType,
    DecayActionType::Keep,
    "\"Keep\""
);
enum_case!(
    decay_action_expire,
    DecayActionType,
    DecayActionType::Expire,
    "\"Expire\""
);
enum_case!(
    decay_action_archive,
    DecayActionType,
    DecayActionType::Archive,
    "\"Archive\""
);

enum_case!(channel_web, Channel, Channel::Web, "\"web\"");
enum_case!(channel_telegram, Channel, Channel::Telegram, "\"telegram\"");
enum_case!(channel_system, Channel, Channel::System, "\"system\"");
enum_case!(channel_celery, Channel, Channel::Celery, "\"celery\"");

enum_case!(role_user, Role, Role::User, "\"user\"");
enum_case!(role_assistant, Role, Role::Assistant, "\"assistant\"");
enum_case!(role_system, Role, Role::System, "\"system\"");

enum_case!(rule_tone, RuleCategory, RuleCategory::Tone, "\"tone\"");
enum_case!(
    rule_mail_behavior,
    RuleCategory,
    RuleCategory::MailBehavior,
    "\"mail_behavior\""
);
enum_case!(
    rule_work_style,
    RuleCategory,
    RuleCategory::WorkStyle,
    "\"work_style\""
);
enum_case!(
    rule_formatting,
    RuleCategory,
    RuleCategory::Formatting,
    "\"formatting\""
);
enum_case!(
    rule_security,
    RuleCategory,
    RuleCategory::Security,
    "\"security\""
);

#[test]
fn memory_type_known_values_roundtrip() {
    let values = [
        MemoryType::Profile,
        MemoryType::Health,
        MemoryType::Preference,
        MemoryType::Relationship,
        MemoryType::Event,
        MemoryType::Location,
        MemoryType::Work,
        MemoryType::Finance,
        MemoryType::Security,
        MemoryType::Intimate,
    ];
    for value in values {
        let json = to_string(&value).expect("serialize memory type");
        let back: MemoryType = from_str(&json).expect("deserialize memory type");
        assert_eq!(back, value);
    }
}

#[test]
fn memory_type_unknown_maps_to_other() {
    let back: MemoryType = from_str("\"custom_future_type\"").expect("deserialize memory type");
    assert_eq!(back, MemoryType::Other("custom_future_type".to_owned()));
}

#[test]
fn memory_type_other_serializes_raw_string() {
    let value = MemoryType::Other("custom_future_type".to_owned());
    let json = to_string(&value).expect("serialize");
    assert_eq!(json, "\"custom_future_type\"");
}

#[test]
fn decay_action_reduce_confidence_roundtrip() {
    let value = DecayActionType::ReduceConfidence {
        new_confidence: 0.42,
    };
    let json = to_string(&value).expect("serialize");
    let back: DecayActionType = from_str(&json).expect("deserialize");
    assert_eq!(back, value);
}

macro_rules! invalid_closed_enum_case {
    ($name:ident, $ty:ty, $json:literal) => {
        #[test]
        fn $name() {
            let result: Result<$ty, _> = from_str($json);
            assert!(result.is_err());
        }
    };
}

invalid_closed_enum_case!(invalid_sensitivity_fails, Sensitivity, "\"S9\"");
invalid_closed_enum_case!(invalid_trust_level_fails, TrustLevel, "\"T9\"");
invalid_closed_enum_case!(invalid_authority_level_fails, AuthorityLevel, "\"A9\"");
invalid_closed_enum_case!(
    invalid_handling_policy_fails,
    HandlingPolicy,
    "\"cloud_plain\""
);
invalid_closed_enum_case!(invalid_source_type_fails, SourceType, "\"external_feed\"");
invalid_closed_enum_case!(invalid_authority_class_fails, AuthorityClass, "\"secrets\"");
invalid_closed_enum_case!(invalid_approval_class_fails, ApprovalClass, "\"class9\"");
invalid_closed_enum_case!(invalid_audit_result_fails, AuditResult, "\"unknown\"");
invalid_closed_enum_case!(invalid_channel_fails, Channel, "\"email\"");
