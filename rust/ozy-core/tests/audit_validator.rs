use ozy_contracts::{
    AuditEntry, AuditEventType, AuditResult, AuditValidationResult, Channel, Sensitivity,
};
use ozy_core::validate_audit_entry;

fn base_entry() -> AuditEntry {
    AuditEntry {
        event_type: AuditEventType::ActionExecuted,
        result: AuditResult::Success,
        actor: "system:worker".to_owned(),
        target_id: "claim:42".to_owned(),
        detail: "action executed successfully".to_owned(),
        timestamp: "2026-04-04T12:34:56Z".to_owned(),
        sensitivity: Sensitivity::S1,
        channel: Channel::System,
        payload: Some("{\"k\":\"v\"}".to_owned()),
        source_ref: Some("turn:123".to_owned()),
    }
}

fn validate(entry: &AuditEntry) -> AuditValidationResult {
    validate_audit_entry(entry).expect("validate_audit_entry should return Ok")
}

fn assert_valid(result: AuditValidationResult) {
    assert_eq!(result, AuditValidationResult::Valid);
}

fn extract_errors(result: AuditValidationResult) -> Vec<String> {
    match result {
        AuditValidationResult::Valid => vec![],
        AuditValidationResult::Invalid { errors, .. } => errors,
    }
}

fn extract_warnings(result: AuditValidationResult) -> Vec<String> {
    match result {
        AuditValidationResult::Valid => vec![],
        AuditValidationResult::Invalid { warnings, .. } => warnings,
    }
}

fn assert_has_error(result: AuditValidationResult, token: &str) {
    let errors = extract_errors(result);
    assert!(
        errors.iter().any(|error| error.contains(token)),
        "expected an error containing `{token}`, got: {errors:?}"
    );
}

#[test]
fn valid_entry_is_valid() {
    let entry = base_entry();
    assert_valid(validate(&entry));
}

#[test]
fn actor_empty_fails() {
    let mut entry = base_entry();
    entry.actor = String::new();
    assert_has_error(validate(&entry), "actor");
}

#[test]
fn actor_whitespace_only_fails() {
    let mut entry = base_entry();
    entry.actor = " \n\t ".to_owned();
    assert_has_error(validate(&entry), "actor");
}

#[test]
fn target_id_empty_fails() {
    let mut entry = base_entry();
    entry.target_id = String::new();
    assert_has_error(validate(&entry), "target_id");
}

#[test]
fn target_id_whitespace_only_fails() {
    let mut entry = base_entry();
    entry.target_id = "   ".to_owned();
    assert_has_error(validate(&entry), "target_id");
}

#[test]
fn detail_empty_fails() {
    let mut entry = base_entry();
    entry.detail = String::new();
    assert_has_error(validate(&entry), "detail");
}

#[test]
fn detail_whitespace_only_fails() {
    let mut entry = base_entry();
    entry.detail = "\n\t".to_owned();
    assert_has_error(validate(&entry), "detail");
}

#[test]
fn timestamp_empty_fails() {
    let mut entry = base_entry();
    entry.timestamp = String::new();
    assert_has_error(validate(&entry), "timestamp");
}

#[test]
fn timestamp_whitespace_only_fails() {
    let mut entry = base_entry();
    entry.timestamp = "  ".to_owned();
    assert_has_error(validate(&entry), "timestamp");
}

#[test]
fn timestamp_date_only_fails() {
    let mut entry = base_entry();
    entry.timestamp = "2026-04-04".to_owned();
    assert_has_error(validate(&entry), "timestamp");
}

#[test]
fn timestamp_epoch_string_fails() {
    let mut entry = base_entry();
    entry.timestamp = "1712234096".to_owned();
    assert_has_error(validate(&entry), "timestamp");
}

#[test]
fn timestamp_with_space_separator_fails() {
    let mut entry = base_entry();
    entry.timestamp = "2026-04-04 12:34:56Z".to_owned();
    assert_has_error(validate(&entry), "timestamp");
}

#[test]
fn timestamp_iso_utc_z_is_valid() {
    let mut entry = base_entry();
    entry.timestamp = "2026-04-04T12:34:56Z".to_owned();
    assert_valid(validate(&entry));
}

#[test]
fn timestamp_iso_with_offset_is_valid() {
    let mut entry = base_entry();
    entry.timestamp = "2026-04-04T12:34:56+02:00".to_owned();
    assert_valid(validate(&entry));
}

#[test]
fn timestamp_iso_with_millis_and_offset_is_valid() {
    let mut entry = base_entry();
    entry.timestamp = "2026-04-04T12:34:56.123+02:00".to_owned();
    assert_valid(validate(&entry));
}

#[test]
fn timestamp_iso_with_fractional_z_is_valid() {
    let mut entry = base_entry();
    entry.timestamp = "2026-04-04T12:34:56.999Z".to_owned();
    assert_valid(validate(&entry));
}

#[test]
fn all_blank_required_fields_collect_multiple_errors() {
    let mut entry = base_entry();
    entry.actor = String::new();
    entry.target_id = " ".to_owned();
    entry.detail = "\t".to_owned();
    entry.timestamp = String::new();
    let errors = extract_errors(validate(&entry));
    assert!(errors.len() >= 4, "expected >=4 errors, got: {errors:?}");
}

#[test]
fn actor_blank_and_invalid_timestamp_collect_two_errors() {
    let mut entry = base_entry();
    entry.actor = " ".to_owned();
    entry.timestamp = "not-a-time".to_owned();
    let errors = extract_errors(validate(&entry));
    assert!(errors.iter().any(|error| error.contains("actor")));
    assert!(errors.iter().any(|error| error.contains("timestamp")));
}

#[test]
fn security_event_s0_fails() {
    let mut entry = base_entry();
    entry.event_type = AuditEventType::SecurityEvent;
    entry.sensitivity = Sensitivity::S0;
    assert_has_error(validate(&entry), "SecurityEvent");
}

#[test]
fn security_event_s1_fails() {
    let mut entry = base_entry();
    entry.event_type = AuditEventType::SecurityEvent;
    entry.sensitivity = Sensitivity::S1;
    assert_has_error(validate(&entry), "SecurityEvent");
}

#[test]
fn security_event_s2_is_valid() {
    let mut entry = base_entry();
    entry.event_type = AuditEventType::SecurityEvent;
    entry.sensitivity = Sensitivity::S2;
    assert_valid(validate(&entry));
}

#[test]
fn security_event_s4_is_valid() {
    let mut entry = base_entry();
    entry.event_type = AuditEventType::SecurityEvent;
    entry.sensitivity = Sensitivity::S4;
    assert_valid(validate(&entry));
}

#[test]
fn manual_override_success_is_valid() {
    let mut entry = base_entry();
    entry.event_type = AuditEventType::ManualOverride;
    entry.result = AuditResult::Success;
    assert_valid(validate(&entry));
}

#[test]
fn manual_override_blocked_is_valid() {
    let mut entry = base_entry();
    entry.event_type = AuditEventType::ManualOverride;
    entry.result = AuditResult::Blocked;
    assert_valid(validate(&entry));
}

#[test]
fn manual_override_failed_fails() {
    let mut entry = base_entry();
    entry.event_type = AuditEventType::ManualOverride;
    entry.result = AuditResult::Failed;
    assert_has_error(validate(&entry), "ManualOverride");
}

#[test]
fn manual_override_rolled_back_fails() {
    let mut entry = base_entry();
    entry.event_type = AuditEventType::ManualOverride;
    entry.result = AuditResult::RolledBack;
    assert_has_error(validate(&entry), "ManualOverride");
}

#[test]
fn s3_with_short_detail_has_no_warning() {
    let mut entry = base_entry();
    entry.sensitivity = Sensitivity::S3;
    entry.detail = "short text".to_owned();
    let warnings = extract_warnings(validate(&entry));
    assert!(
        warnings.is_empty(),
        "expected no warnings, got: {warnings:?}"
    );
}

#[test]
fn s3_with_long_detail_gets_warning() {
    let mut entry = base_entry();
    entry.sensitivity = Sensitivity::S3;
    entry.detail = "a".repeat(501);
    let warnings = extract_warnings(validate(&entry));
    assert!(!warnings.is_empty(), "expected warning for long detail");
}

#[test]
fn s4_with_long_detail_gets_warning() {
    let mut entry = base_entry();
    entry.sensitivity = Sensitivity::S4;
    entry.detail = "a".repeat(800);
    let warnings = extract_warnings(validate(&entry));
    assert!(!warnings.is_empty(), "expected warning for long detail");
}

#[test]
fn s2_with_long_detail_has_no_warning() {
    let mut entry = base_entry();
    entry.sensitivity = Sensitivity::S2;
    entry.detail = "a".repeat(800);
    let warnings = extract_warnings(validate(&entry));
    assert!(
        warnings.is_empty(),
        "expected no warnings, got: {warnings:?}"
    );
}

#[test]
fn warning_and_error_can_coexist() {
    let mut entry = base_entry();
    entry.sensitivity = Sensitivity::S3;
    entry.detail = "a".repeat(700);
    entry.actor = String::new();
    let result = validate(&entry);
    let errors = extract_errors(result.clone());
    let warnings = extract_warnings(result);
    assert!(errors.iter().any(|error| error.contains("actor")));
    assert!(
        !warnings.is_empty(),
        "expected warning to coexist with error"
    );
}

#[test]
fn all_existing_non_special_event_types_are_valid() {
    let events = [
        AuditEventType::TurnProcessed,
        AuditEventType::MemoryConfirmed,
        AuditEventType::MemoryRejected,
        AuditEventType::MemorySuperseded,
        AuditEventType::MemoryRetracted,
        AuditEventType::ActionExecuted,
        AuditEventType::ActionBlocked,
        AuditEventType::ActionRolledBack,
        AuditEventType::SensitivityViolation,
        AuditEventType::CircuitBreakerTripped,
        AuditEventType::PayloadSensitivityWarning,
        AuditEventType::TaintEscalation,
    ];

    for event_type in events {
        let mut entry = base_entry();
        entry.event_type = event_type;
        assert_valid(validate(&entry));
    }
}
