use ozy_contracts::{
    AuditEntry, AuditEventType, AuditResult, AuditValidationResult, OzyError, Sensitivity,
};

use crate::iso8601;

pub fn validate_audit_entry(entry: &AuditEntry) -> Result<AuditValidationResult, OzyError> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    if is_blank(&entry.actor) {
        errors.push("actor must not be empty".to_owned());
    }

    if is_blank(&entry.target_id) {
        errors.push("target_id must not be empty".to_owned());
    }

    if is_blank(&entry.timestamp) {
        errors.push("timestamp must not be empty".to_owned());
    } else if !iso8601::is_valid(&entry.timestamp) {
        errors.push("timestamp must be a valid ISO 8601 datetime".to_owned());
    }

    if is_blank(&entry.detail) {
        errors.push("detail must not be empty".to_owned());
    }

    if entry.event_type == AuditEventType::SecurityEvent
        && sensitivity_rank(entry.sensitivity) < sensitivity_rank(Sensitivity::S2)
    {
        errors.push("SecurityEvent requires sensitivity S2 or higher".to_owned());
    }

    if entry.event_type == AuditEventType::ManualOverride
        && !matches!(entry.result, AuditResult::Success | AuditResult::Blocked)
    {
        errors.push("ManualOverride requires result Success or Blocked".to_owned());
    }

    if sensitivity_rank(entry.sensitivity) >= sensitivity_rank(Sensitivity::S3)
        && entry.detail.chars().count() > 500
    {
        warnings.push("detail length is suspicious for S3+ audit entries".to_owned());
    }

    if errors.is_empty() && warnings.is_empty() {
        Ok(AuditValidationResult::Valid)
    } else {
        Ok(AuditValidationResult::Invalid { errors, warnings })
    }
}

fn is_blank(value: &str) -> bool {
    value.trim().is_empty()
}

fn sensitivity_rank(value: Sensitivity) -> u8 {
    match value {
        Sensitivity::S0 => 0,
        Sensitivity::S1 => 1,
        Sensitivity::S2 => 2,
        Sensitivity::S3 => 3,
        Sensitivity::S4 => 4,
    }
}
