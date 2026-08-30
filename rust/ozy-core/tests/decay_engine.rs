use ozy_contracts::{
    AuthorityClass, ClaimData, DecayAction, DecayActionType, HandlingPolicy, Lifecycle, MemoryType,
    OzyError, Sensitivity, SourceType, TrustLevel, VerificationState,
};
use ozy_core::evaluate_decay;

const NOW: &str = "2026-04-04T12:34:56Z";

fn base_claim() -> ClaimData {
    ClaimData {
        subject: "user:42".to_owned(),
        attribute: Some("city".to_owned()),
        value: "Berlin".to_owned(),
        content: "User lives in Berlin".to_owned(),
        memory_type: MemoryType::Profile,
        authority_class: AuthorityClass::Evidence,
        sensitivity: Sensitivity::S1,
        trust_level: TrustLevel::T2,
        handling_policy: HandlingPolicy::LocalPreferred,
        verification_state: VerificationState::Tentative,
        confidence: 0.8,
        source_type: SourceType::ModelInferred,
        source_ref: Some("claim-1".to_owned()),
        user_locked: false,
        decay_eligible: true,
        lifecycle: Lifecycle::Temporary,
        valid_from: None,
        valid_to: None,
    }
}

fn evaluate_one(mutator: impl FnOnce(&mut ClaimData), now: &str) -> DecayAction {
    let mut claim = base_claim();
    mutator(&mut claim);
    let mut actions = evaluate_decay(&[claim], now).expect("evaluate_decay should return Ok");
    assert_eq!(actions.len(), 1);
    actions.remove(0)
}

fn assert_reduce_confidence(action: DecayAction, expected: f64) {
    match action.action {
        DecayActionType::ReduceConfidence { new_confidence } => {
            assert!((new_confidence - expected).abs() < 1e-12);
        }
        other => panic!("expected ReduceConfidence action, got: {other:?}"),
    }
}

#[test]
fn empty_claims_returns_empty_vec() {
    let actions = evaluate_decay(&[], NOW).expect("evaluate_decay should succeed");
    assert!(actions.is_empty());
}

#[test]
fn invalid_now_returns_invariant_violation() {
    let claim = base_claim();
    let result = evaluate_decay(&[claim], "not-a-time");
    assert!(matches!(result, Err(OzyError::InvariantViolation { .. })));
}

#[test]
fn whitespace_now_returns_invariant_violation() {
    let claim = base_claim();
    let result = evaluate_decay(&[claim], "   ");
    assert!(matches!(result, Err(OzyError::InvariantViolation { .. })));
}

#[test]
fn user_locked_is_kept_even_for_session_lifecycle() {
    let action = evaluate_one(
        |claim| {
            claim.user_locked = true;
            claim.lifecycle = Lifecycle::Session;
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn decay_ineligible_is_kept_even_for_expired_lifecycle() {
    let action = evaluate_one(
        |claim| {
            claim.decay_eligible = false;
            claim.lifecycle = Lifecycle::Expiry;
            claim.valid_to = Some("2020-01-01T00:00:00Z".to_owned());
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn locked_and_ineligible_is_kept() {
    let action = evaluate_one(
        |claim| {
            claim.user_locked = true;
            claim.decay_eligible = false;
            claim.lifecycle = Lifecycle::Session;
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn permanent_claim_is_kept() {
    let action = evaluate_one(|claim| claim.lifecycle = Lifecycle::Permanent, NOW);
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn permanent_claim_is_kept_with_low_confidence() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Permanent;
            claim.confidence = 0.01;
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn session_claim_expires() {
    let action = evaluate_one(|claim| claim.lifecycle = Lifecycle::Session, NOW);
    assert_eq!(action.action, DecayActionType::Expire);
}

#[test]
fn session_claim_expires_even_with_high_confidence() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Session;
            claim.confidence = 1.0;
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Expire);
}

#[test]
fn expiry_with_past_valid_to_expires() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Expiry;
            claim.valid_to = Some("2026-04-04T12:00:00Z".to_owned());
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Expire);
}

#[test]
fn expiry_with_future_valid_to_keeps() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Expiry;
            claim.valid_to = Some("2026-04-04T13:00:00Z".to_owned());
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn expiry_with_equal_valid_to_keeps() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Expiry;
            claim.valid_to = Some(NOW.to_owned());
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn expiry_with_none_valid_to_keeps() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Expiry;
            claim.valid_to = None;
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn expiry_with_offset_timestamp_can_expire() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Expiry;
            claim.valid_to = Some("2026-04-04T12:00:00+00:00".to_owned());
        },
        "2026-04-04T12:34:56+00:00",
    );
    assert_eq!(action.action, DecayActionType::Expire);
}

#[test]
fn temporary_below_threshold_archives() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Temporary;
            claim.confidence = 0.29;
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Archive);
}

#[test]
fn temporary_at_threshold_reduces_confidence() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Temporary;
            claim.confidence = 0.3;
        },
        NOW,
    );
    assert_reduce_confidence(action, 0.27);
}

#[test]
fn temporary_above_threshold_reduces_confidence() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Temporary;
            claim.confidence = 0.5;
        },
        NOW,
    );
    assert_reduce_confidence(action, 0.45);
}

#[test]
fn temporary_one_reduces_to_nine_tenths() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Temporary;
            claim.confidence = 1.0;
        },
        NOW,
    );
    assert_reduce_confidence(action, 0.9);
}

#[test]
fn temporary_zero_confidence_archives() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Temporary;
            claim.confidence = 0.0;
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Archive);
}

#[test]
fn temporary_nan_confidence_archives() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Temporary;
            claim.confidence = f64::NAN;
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Archive);
}

#[test]
fn claim_ref_uses_source_ref() {
    let action = evaluate_one(|_| {}, NOW);
    assert_eq!(action.claim_ref, "claim-1");
}

#[test]
fn claim_ref_is_empty_when_source_ref_missing() {
    let action = evaluate_one(|claim| claim.source_ref = None, NOW);
    assert!(action.claim_ref.is_empty());
}

#[test]
fn mixed_batch_produces_expected_actions() {
    let mut c1 = base_claim();
    c1.source_ref = Some("c1".to_owned());
    c1.lifecycle = Lifecycle::Session;

    let mut c2 = base_claim();
    c2.source_ref = Some("c2".to_owned());
    c2.lifecycle = Lifecycle::Temporary;
    c2.confidence = 0.2;

    let mut c3 = base_claim();
    c3.source_ref = Some("c3".to_owned());
    c3.lifecycle = Lifecycle::Permanent;

    let actions = evaluate_decay(&[c1, c2, c3], NOW).expect("evaluate_decay should return Ok");
    assert_eq!(actions.len(), 3);
    assert_eq!(actions[0].action, DecayActionType::Expire);
    assert_eq!(actions[1].action, DecayActionType::Archive);
    assert_eq!(actions[2].action, DecayActionType::Keep);
}

#[test]
fn output_order_matches_input_order() {
    let mut c1 = base_claim();
    c1.source_ref = Some("first".to_owned());
    c1.lifecycle = Lifecycle::Session;

    let mut c2 = base_claim();
    c2.source_ref = Some("second".to_owned());
    c2.lifecycle = Lifecycle::Permanent;

    let actions = evaluate_decay(&[c1, c2], NOW).expect("evaluate_decay should return Ok");
    assert_eq!(actions[0].claim_ref, "first");
    assert_eq!(actions[1].claim_ref, "second");
}

#[test]
fn multiple_session_claims_all_expire() {
    let mut c1 = base_claim();
    c1.lifecycle = Lifecycle::Session;
    let mut c2 = base_claim();
    c2.lifecycle = Lifecycle::Session;
    let mut c3 = base_claim();
    c3.lifecycle = Lifecycle::Session;

    let actions = evaluate_decay(&[c1, c2, c3], NOW).expect("evaluate_decay should return Ok");
    assert!(
        actions
            .iter()
            .all(|action| action.action == DecayActionType::Expire)
    );
}

#[test]
fn very_old_valid_to_expires() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Expiry;
            claim.valid_to = Some("1999-01-01T00:00:00Z".to_owned());
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Expire);
}

#[test]
fn now_with_fractional_seconds_is_accepted() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Permanent;
        },
        "2026-04-04T12:34:56.123Z",
    );
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn reduce_confidence_half_is_precise() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Temporary;
            claim.confidence = 0.5;
        },
        NOW,
    );
    assert_reduce_confidence(action, 0.45);
}

#[test]
fn reduce_confidence_boundary_three_tenths_is_not_archive() {
    let action = evaluate_one(
        |claim| {
            claim.lifecycle = Lifecycle::Temporary;
            claim.confidence = 0.3;
        },
        NOW,
    );
    assert!(matches!(
        action.action,
        DecayActionType::ReduceConfidence { .. }
    ));
}

#[test]
fn locked_overrides_session_rule() {
    let action = evaluate_one(
        |claim| {
            claim.user_locked = true;
            claim.lifecycle = Lifecycle::Session;
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Keep);
}

#[test]
fn ineligible_overrides_expiry_rule() {
    let action = evaluate_one(
        |claim| {
            claim.decay_eligible = false;
            claim.lifecycle = Lifecycle::Expiry;
            claim.valid_to = Some("2020-01-01T00:00:00Z".to_owned());
        },
        NOW,
    );
    assert_eq!(action.action, DecayActionType::Keep);
}
