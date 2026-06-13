use ozy_contracts::{CircuitBreakerConfig, CircuitBreakerDecision, CircuitBreakerStatus, OzyError};
use ozy_core::check_circuit_breaker;

fn base_config() -> CircuitBreakerConfig {
    CircuitBreakerConfig {
        max_actions_per_window: 10,
        window_seconds: 60,
        cooldown_seconds: 60,
    }
}

fn assert_invariant_violation(result: Result<CircuitBreakerDecision, OzyError>) {
    assert!(matches!(result, Err(OzyError::InvariantViolation { .. })));
}

fn assert_allow(result: Result<CircuitBreakerDecision, OzyError>) {
    assert_eq!(
        result.expect("result should be Ok"),
        CircuitBreakerDecision::Allow
    );
}

fn assert_trip(result: Result<CircuitBreakerDecision, OzyError>) -> String {
    match result.expect("result should be Ok") {
        CircuitBreakerDecision::Trip { reason } => reason,
        other => panic!("expected Trip decision, got: {other:?}"),
    }
}

fn assert_cooldown(
    result: Result<CircuitBreakerDecision, OzyError>,
    expected_remaining_seconds: u64,
) {
    match result.expect("result should be Ok") {
        CircuitBreakerDecision::CooldownActive { remaining_seconds } => {
            assert_eq!(remaining_seconds, expected_remaining_seconds);
        }
        other => panic!("expected CooldownActive decision, got: {other:?}"),
    }
}

#[test]
fn config_max_actions_zero_returns_invariant_violation() {
    let mut config = base_config();
    config.max_actions_per_window = 0;
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Open, None);
    assert_invariant_violation(result);
}

#[test]
fn config_window_seconds_zero_returns_invariant_violation() {
    let mut config = base_config();
    config.window_seconds = 0;
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Open, None);
    assert_invariant_violation(result);
}

#[test]
fn config_cooldown_seconds_zero_returns_invariant_violation() {
    let mut config = base_config();
    config.cooldown_seconds = 0;
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Open, None);
    assert_invariant_violation(result);
}

#[test]
fn config_all_three_zero_returns_invariant_violation() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 0,
        window_seconds: 0,
        cooldown_seconds: 0,
    };
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Open, None);
    assert_invariant_violation(result);
}

#[test]
fn config_two_fields_zero_returns_invariant_violation() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 0,
        window_seconds: 0,
        cooldown_seconds: 30,
    };
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Open, None);
    assert_invariant_violation(result);
}

#[test]
fn open_status_count_zero_of_ten_allows() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Open, None);
    assert_allow(result);
}

#[test]
fn open_status_count_nine_of_ten_allows() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 9, &CircuitBreakerStatus::Open, None);
    assert_allow(result);
}

#[test]
fn open_status_count_zero_of_one_allows() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 1,
        window_seconds: 60,
        cooldown_seconds: 60,
    };
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Open, None);
    assert_allow(result);
}

#[test]
fn open_status_count_equal_to_max_trips() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 10, &CircuitBreakerStatus::Open, None);
    assert_trip(result);
}

#[test]
fn open_status_count_above_max_trips() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 11, &CircuitBreakerStatus::Open, None);
    assert_trip(result);
}

#[test]
fn open_status_count_one_of_one_trips() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 1,
        window_seconds: 60,
        cooldown_seconds: 60,
    };
    let result = check_circuit_breaker(&config, 1, &CircuitBreakerStatus::Open, None);
    assert_trip(result);
}

#[test]
fn closed_status_elapsed_30_of_60_returns_remaining_30() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, Some(30));
    assert_cooldown(result, 30);
}

#[test]
fn closed_status_elapsed_0_returns_full_cooldown() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, Some(0));
    assert_cooldown(result, 60);
}

#[test]
fn closed_status_elapsed_59_of_60_returns_remaining_1() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, Some(59));
    assert_cooldown(result, 1);
}

#[test]
fn closed_status_elapsed_equal_to_cooldown_allows() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, Some(60));
    assert_allow(result);
}

#[test]
fn closed_status_elapsed_above_cooldown_allows() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, Some(1000));
    assert_allow(result);
}

#[test]
fn closed_status_without_elapsed_timestamp_returns_full_cooldown() {
    let config = base_config();
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, None);
    assert_cooldown(result, 60);
}

#[test]
fn tripped_status_returns_full_cooldown() {
    let config = base_config();
    let status = CircuitBreakerStatus::Tripped {
        reason: "prior trip".to_owned(),
    };
    let result = check_circuit_breaker(&config, 0, &status, None);
    assert_cooldown(result, 60);
}

#[test]
fn tripped_status_ignores_high_count_and_returns_full_cooldown() {
    let config = base_config();
    let status = CircuitBreakerStatus::Tripped {
        reason: "prior trip".to_owned(),
    };
    let result = check_circuit_breaker(&config, 999, &status, None);
    assert_cooldown(result, 60);
}

#[test]
fn tripped_status_ignores_elapsed_and_returns_full_cooldown() {
    let config = base_config();
    let status = CircuitBreakerStatus::Tripped {
        reason: "prior trip".to_owned(),
    };
    let result = check_circuit_breaker(&config, 0, &status, Some(59));
    assert_cooldown(result, 60);
}

#[test]
fn trip_reason_mentions_exceeded_limit() {
    let config = base_config();
    let reason = assert_trip(check_circuit_breaker(
        &config,
        10,
        &CircuitBreakerStatus::Open,
        None,
    ));
    assert!(reason.to_ascii_lowercase().contains("exceed"));
}

#[test]
fn trip_reason_mentions_count_or_max() {
    let config = base_config();
    let reason = assert_trip(check_circuit_breaker(
        &config,
        10,
        &CircuitBreakerStatus::Open,
        None,
    ));
    let lowercase = reason.to_ascii_lowercase();
    assert!(lowercase.contains("count") || lowercase.contains("max"));
}

#[test]
fn edge_max_one_count_zero_allows() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 1,
        window_seconds: 60,
        cooldown_seconds: 60,
    };
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Open, None);
    assert_allow(result);
}

#[test]
fn edge_max_one_count_one_trips() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 1,
        window_seconds: 60,
        cooldown_seconds: 60,
    };
    let result = check_circuit_breaker(&config, 1, &CircuitBreakerStatus::Open, None);
    assert_trip(result);
}

#[test]
fn edge_cooldown_one_elapsed_zero_returns_remaining_one() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 10,
        window_seconds: 60,
        cooldown_seconds: 1,
    };
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, Some(0));
    assert_cooldown(result, 1);
}

#[test]
fn edge_cooldown_one_elapsed_one_allows() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 10,
        window_seconds: 60,
        cooldown_seconds: 1,
    };
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, Some(1));
    assert_allow(result);
}

#[test]
fn boundary_u32_max_below_limit_allows() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: u32::MAX,
        window_seconds: 60,
        cooldown_seconds: 60,
    };
    let result = check_circuit_breaker(&config, u32::MAX - 1, &CircuitBreakerStatus::Open, None);
    assert_allow(result);
}

#[test]
fn boundary_very_large_cooldown_values_work() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 10,
        window_seconds: 60,
        cooldown_seconds: u64::MAX,
    };
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, Some(1));
    assert_cooldown(result, u64::MAX - 1);
}

#[test]
fn boundary_count_exactly_at_custom_limit_trips() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 42,
        window_seconds: 60,
        cooldown_seconds: 60,
    };
    let result = check_circuit_breaker(&config, 42, &CircuitBreakerStatus::Open, None);
    assert_trip(result);
}

#[test]
fn remaining_seconds_matches_cooldown_minus_elapsed_exactly() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 10,
        window_seconds: 60,
        cooldown_seconds: 123,
    };
    let result = check_circuit_breaker(&config, 0, &CircuitBreakerStatus::Closed, Some(23));
    assert_cooldown(result, 100);
}

#[test]
fn tripped_status_remaining_seconds_is_always_full_cooldown() {
    let config = CircuitBreakerConfig {
        max_actions_per_window: 10,
        window_seconds: 60,
        cooldown_seconds: 77,
    };
    let status = CircuitBreakerStatus::Tripped {
        reason: "prior trip".to_owned(),
    };
    let result = check_circuit_breaker(&config, 10, &status, Some(76));
    assert_cooldown(result, 77);
}
