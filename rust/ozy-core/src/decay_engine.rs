use ozy_contracts::{ClaimData, DecayAction, DecayActionType, Lifecycle, OzyError};

use crate::iso8601::parse_to_utc_key;

/// One action per claim, in the order the claims arrived.
///
/// Callers pair the two lists by position. `claim_ref` cannot do that job: it
/// carries the `source_ref`, which every claim written by the same turn shares.
pub fn evaluate_decay(claims: &[ClaimData], now: &str) -> Result<Vec<DecayAction>, OzyError> {
    let now_key = match parse_to_utc_key(now) {
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
                        match parse_to_utc_key(valid_to) {
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
