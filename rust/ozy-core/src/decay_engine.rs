use ozy_contracts::{ClaimData, DecayAction, DecayActionType, Lifecycle, OzyError};

pub fn evaluate_decay(claims: &[ClaimData], now: &str) -> Result<Vec<DecayAction>, OzyError> {
    let now_key = match parse_iso8601_to_utc_key(now) {
        Some(key) => key,
        None => {
            return Err(OzyError::InvariantViolation {
                message: "now must be a valid ISO 8601 timestamp".to_owned(),
            });
        }
    };

    let mut actions = Vec::with_capacity(claims.len());

    for claim in claims {
        let action = if claim.user_locked || !claim.decay_eligible {
            DecayActionType::Keep
        } else {
            match claim.lifecycle {
                Lifecycle::Permanent => DecayActionType::Keep,
                Lifecycle::Session => DecayActionType::Expire,
                Lifecycle::Expiry => {
                    if let Some(valid_to) = claim.valid_to.as_deref() {
                        match parse_iso8601_to_utc_key(valid_to) {
                            Some(valid_to_key) if valid_to_key < now_key => DecayActionType::Expire,
                            _ => DecayActionType::Keep,
                        }
                    } else {
                        DecayActionType::Keep
                    }
                }
                Lifecycle::Temporary => {
                    if !claim.confidence.is_finite() || claim.confidence < 0.3 {
                        DecayActionType::Archive
                    } else {
                        DecayActionType::ReduceConfidence {
                            new_confidence: claim.confidence * 0.9,
                        }
                    }
                }
            }
        };

        actions.push(DecayAction {
            claim_ref: claim.source_ref.clone().unwrap_or_default(),
            action,
        });
    }

    Ok(actions)
}

fn parse_iso8601_to_utc_key(value: &str) -> Option<(i64, u32)> {
    let bytes = value.as_bytes();

    if bytes.len() < 20 {
        return None;
    }

    if bytes.get(4) != Some(&b'-')
        || bytes.get(7) != Some(&b'-')
        || bytes.get(10) != Some(&b'T')
        || bytes.get(13) != Some(&b':')
        || bytes.get(16) != Some(&b':')
    {
        return None;
    }

    let year = parse_n_digits(bytes, 0, 4)? as i32;
    let month = parse_n_digits(bytes, 5, 2)? as u32;
    let day = parse_n_digits(bytes, 8, 2)? as u32;
    let hour = parse_n_digits(bytes, 11, 2)? as u32;
    let minute = parse_n_digits(bytes, 14, 2)? as u32;
    let second = parse_n_digits(bytes, 17, 2)? as u32;

    if !(1..=12).contains(&month)
        || day == 0
        || day > days_in_month(year, month)
        || hour > 23
        || minute > 59
        || second > 59
    {
        return None;
    }

    let mut index = 19;
    let mut nanos: u32 = 0;

    if bytes.get(index) == Some(&b'.') {
        index += 1;
        let start = index;
        while index < bytes.len() && bytes[index].is_ascii_digit() {
            index += 1;
        }

        let frac_len = index.saturating_sub(start);
        if frac_len == 0 || frac_len > 9 {
            return None;
        }

        let frac_value = parse_n_digits(bytes, start, frac_len)? as u32;
        let scale = 10_u32.pow((9 - frac_len) as u32);
        nanos = frac_value * scale;
    }

    let offset_minutes: i32 = match bytes.get(index) {
        Some(b'Z') => {
            if index + 1 != bytes.len() {
                return None;
            }
            0
        }
        Some(b'+') | Some(b'-') => {
            if index + 6 != bytes.len() {
                return None;
            }
            if bytes.get(index + 3) != Some(&b':') {
                return None;
            }

            let sign = if bytes[index] == b'+' { 1 } else { -1 };
            let tz_hour = parse_n_digits(bytes, index + 1, 2)? as i32;
            let tz_minute = parse_n_digits(bytes, index + 4, 2)? as i32;
            if tz_hour > 23 || tz_minute > 59 {
                return None;
            }
            sign * (tz_hour * 60 + tz_minute)
        }
        _ => return None,
    };

    let days = days_from_civil(year, month, day);
    let local_seconds =
        days * 86_400 + i64::from(hour) * 3_600 + i64::from(minute) * 60 + i64::from(second);
    let utc_seconds = local_seconds - i64::from(offset_minutes) * 60;
    Some((utc_seconds, nanos))
}

fn parse_n_digits(bytes: &[u8], start: usize, len: usize) -> Option<u64> {
    if start.checked_add(len)? > bytes.len() {
        return None;
    }

    let mut value = 0_u64;
    for &byte in &bytes[start..start + len] {
        if !byte.is_ascii_digit() {
            return None;
        }
        value = value * 10 + u64::from(byte - b'0');
    }
    Some(value)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap_year(year) => 29,
        2 => 28,
        _ => 0,
    }
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let y = i64::from(year) - i64::from(month <= 2);
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let m = i64::from(month);
    let d = i64::from(day);
    let doy = (153 * (m + if m > 2 { -3 } else { 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}
