//! One ISO 8601 reader for the whole core.
//!
//! Two modules need timestamps: decay compares them, the audit validator only
//! asks whether one is well formed. They used to carry a parser each, and the
//! copies had drifted — the audit side accepted `2026-02-31`, the decay side
//! did not. A single parser keeps "valid" meaning the same thing everywhere.
//!
//! No `chrono`/`time` dependency on purpose: the core stays free of anything
//! that could pull in I/O or a clock, and the subset we accept is small.

/// Sort key for an instant: seconds since the Unix epoch plus nanoseconds.
///
/// `None` means the value is not a timestamp we accept. Offsets are folded into
/// UTC, so two keys are comparable regardless of the offset they arrived with.
pub(crate) fn parse_to_utc_key(value: &str) -> Option<(i64, u32)> {
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
        if frac_len == 0 {
            return None;
        }

        // ISO 8601 allows any precision, we keep nanoseconds and drop the rest.
        // Rejecting the value instead would fail a legal timestamp over digits
        // finer than this key can express.
        let kept = frac_len.min(9);
        let frac_value = parse_n_digits(bytes, start, kept)? as u32;
        nanos = frac_value * 10_u32.pow((9 - kept) as u32);
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

/// Whether `value` is a timestamp this core accepts.
pub(crate) fn is_valid(value: &str) -> bool {
    parse_to_utc_key(value).is_some()
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

/// Days between 1970-01-01 and the given civil date, after Howard Hinnant.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utc_and_offset_describe_the_same_instant() {
        assert_eq!(
            parse_to_utc_key("2026-04-04T12:00:00Z"),
            parse_to_utc_key("2026-04-04T14:00:00+02:00")
        );
    }

    #[test]
    fn impossible_day_of_month_is_rejected() {
        assert!(!is_valid("2026-02-31T00:00:00Z"));
        assert!(!is_valid("2026-04-31T00:00:00Z"));
        assert!(is_valid("2024-02-29T00:00:00Z"));
        assert!(!is_valid("2026-02-29T00:00:00Z"));
    }

    #[test]
    fn fraction_finer_than_nanoseconds_is_kept_not_rejected() {
        let nanos = parse_to_utc_key("2026-04-04T12:00:00.123456789123Z")
            .expect("a legal timestamp should parse")
            .1;
        assert_eq!(nanos, 123_456_789);
    }

    #[test]
    fn fraction_shorter_than_nanoseconds_scales_up() {
        let nanos = parse_to_utc_key("2026-04-04T12:00:00.5Z")
            .expect("a legal timestamp should parse")
            .1;
        assert_eq!(nanos, 500_000_000);
    }

    #[test]
    fn a_dot_without_digits_is_rejected() {
        assert!(!is_valid("2026-04-04T12:00:00.Z"));
    }

    #[test]
    fn missing_zone_is_rejected() {
        assert!(!is_valid("2026-04-04T12:00:00"));
    }
}
