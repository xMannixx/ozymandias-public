use ozy_contracts::{
    AuditEntry, AuditEventType, AuditResult, AuditValidationResult, OzyError, Sensitivity,
};

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
    } else if !is_valid_iso8601(&entry.timestamp) {
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

fn is_valid_iso8601(value: &str) -> bool {
    let bytes = value.as_bytes();

    if bytes.len() < 20 {
        return false;
    }

    if bytes.get(4) != Some(&b'-')
        || bytes.get(7) != Some(&b'-')
        || bytes.get(10) != Some(&b'T')
        || bytes.get(13) != Some(&b':')
        || bytes.get(16) != Some(&b':')
    {
        return false;
    }

    let month = match parse_two_digits(bytes, 5) {
        Some(v) => v,
        None => return false,
    };
    let day = match parse_two_digits(bytes, 8) {
        Some(v) => v,
        None => return false,
    };
    let hour = match parse_two_digits(bytes, 11) {
        Some(v) => v,
        None => return false,
    };
    let minute = match parse_two_digits(bytes, 14) {
        Some(v) => v,
        None => return false,
    };
    let second = match parse_two_digits(bytes, 17) {
        Some(v) => v,
        None => return false,
    };

    if !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
        || hour > 23
        || minute > 59
        || second > 59
    {
        return false;
    }

    if !digits_only(bytes, 0, 4) {
        return false;
    }

    let mut index = 19;

    if bytes.get(index) == Some(&b'.') {
        index += 1;
        let start = index;
        while index < bytes.len() && bytes[index].is_ascii_digit() {
            index += 1;
        }

        if index == start {
            return false;
        }
    }

    match bytes.get(index) {
        Some(b'Z') => index + 1 == bytes.len(),
        Some(b'+') | Some(b'-') => {
            if index + 6 != bytes.len() {
                return false;
            }

            if bytes.get(index + 3) != Some(&b':') {
                return false;
            }

            let tz_hour = match parse_two_digits(bytes, index + 1) {
                Some(v) => v,
                None => return false,
            };
            let tz_minute = match parse_two_digits(bytes, index + 4) {
                Some(v) => v,
                None => return false,
            };

            tz_hour <= 23 && tz_minute <= 59
        }
        _ => false,
    }
}

fn parse_two_digits(bytes: &[u8], start: usize) -> Option<u8> {
    let first = *bytes.get(start)?;
    let second = *bytes.get(start + 1)?;

    if !first.is_ascii_digit() || !second.is_ascii_digit() {
        return None;
    }

    Some((first - b'0') * 10 + (second - b'0'))
}

fn digits_only(bytes: &[u8], start: usize, len: usize) -> bool {
    (start..start + len).all(|index| bytes[index].is_ascii_digit())
}
