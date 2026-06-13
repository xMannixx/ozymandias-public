use ozy_contracts::{CircuitBreakerConfig, CircuitBreakerDecision, CircuitBreakerStatus, OzyError};

pub fn check_circuit_breaker(
    config: &CircuitBreakerConfig,
    current_count: u32,
    current_status: &CircuitBreakerStatus,
    seconds_since_last_trip: Option<u64>,
) -> Result<CircuitBreakerDecision, OzyError> {
    validate_config(config)?;

    match current_status {
        CircuitBreakerStatus::Tripped { .. } => Ok(CircuitBreakerDecision::CooldownActive {
            remaining_seconds: config.cooldown_seconds,
        }),
        CircuitBreakerStatus::Closed => match seconds_since_last_trip {
            None => Ok(CircuitBreakerDecision::CooldownActive {
                remaining_seconds: config.cooldown_seconds,
            }),
            Some(elapsed) if elapsed < config.cooldown_seconds => {
                Ok(CircuitBreakerDecision::CooldownActive {
                    remaining_seconds: config.cooldown_seconds - elapsed,
                })
            }
            Some(_) => Ok(CircuitBreakerDecision::Allow),
        },
        CircuitBreakerStatus::Open => {
            if current_count >= config.max_actions_per_window {
                Ok(CircuitBreakerDecision::Trip {
                    reason: format!(
                        "circuit breaker limit exceeded: count {} >= max {} in {}s window",
                        current_count, config.max_actions_per_window, config.window_seconds
                    ),
                })
            } else {
                Ok(CircuitBreakerDecision::Allow)
            }
        }
    }
}

fn validate_config(config: &CircuitBreakerConfig) -> Result<(), OzyError> {
    if config.max_actions_per_window == 0 {
        return Err(OzyError::InvariantViolation {
            message: "max_actions_per_window must be > 0".to_owned(),
        });
    }

    if config.window_seconds == 0 {
        return Err(OzyError::InvariantViolation {
            message: "window_seconds must be > 0".to_owned(),
        });
    }

    if config.cooldown_seconds == 0 {
        return Err(OzyError::InvariantViolation {
            message: "cooldown_seconds must be > 0".to_owned(),
        });
    }

    Ok(())
}
