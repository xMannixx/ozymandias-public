use ozy_contracts::{
    ClaimData, FilterReason, HandlingPolicy, Lifecycle, MemoryType, Sensitivity,
    SensitivityFilterInput, SensitivityFilterOutput, SourceType, TrustLevel, VerificationState,
};
use ozy_core::filter_claims;

fn claim_with_sensitivity(sensitivity: Sensitivity) -> ClaimData {
    ClaimData {
        subject: "user:42".to_owned(),
        attribute: Some("topic".to_owned()),
        value: "value".to_owned(),
        content: "content".to_owned(),
        memory_type: MemoryType::Profile,
        sensitivity,
        trust_level: TrustLevel::T3,
        handling_policy: HandlingPolicy::LocalPreferred,
        verification_state: VerificationState::Confirmed,
        confidence: 0.9,
        source_type: SourceType::UserExplicit,
        source_ref: Some("turn:1".to_owned()),
        user_locked: false,
        decay_eligible: true,
        lifecycle: Lifecycle::Permanent,
        valid_from: None,
        valid_to: None,
    }
}

fn run_filter(
    claims: Vec<ClaimData>,
    intent_type: &str,
    provider_is_local: bool,
    provider_is_encrypted: bool,
) -> SensitivityFilterOutput {
    run_filter_with_s3_fallback(
        claims,
        intent_type,
        provider_is_local,
        provider_is_encrypted,
        false,
    )
}

fn run_filter_with_s3_fallback(
    claims: Vec<ClaimData>,
    intent_type: &str,
    provider_is_local: bool,
    provider_is_encrypted: bool,
    allow_s3_cloud_fallback: bool,
) -> SensitivityFilterOutput {
    let input = SensitivityFilterInput {
        claims,
        intent_type: intent_type.to_owned(),
        provider_is_local,
        provider_is_encrypted,
        allow_s3_cloud_fallback,
    };

    filter_claims(&input).expect("filter_claims should not error")
}

#[test]
fn s0_is_allowed_on_remote_unencrypted_provider() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S0)],
        "work",
        false,
        false,
    );
    assert_eq!(output.allowed.len(), 1);
    assert_eq!(output.filtered_count, 0);
    assert!(output.filter_reasons.is_empty());
}

#[test]
fn s1_is_allowed_on_remote_unencrypted_provider() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S1)],
        "work",
        false,
        false,
    );
    assert_eq!(output.allowed.len(), 1);
    assert_eq!(output.filtered_count, 0);
}

#[test]
fn s2_is_allowed_when_provider_is_encrypted() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S2)],
        "work",
        false,
        true,
    );
    assert_eq!(output.allowed.len(), 1);
    assert_eq!(output.filtered_count, 0);
}

#[test]
fn s2_is_filtered_when_provider_is_not_encrypted() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S2)],
        "work",
        false,
        false,
    );
    assert!(output.allowed.is_empty());
    assert_eq!(output.filtered_count, 1);
    assert_eq!(
        output.filter_reasons,
        vec![FilterReason::ProviderNotEncrypted]
    );
}

#[test]
fn s2_local_but_not_encrypted_is_still_filtered() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S2)],
        "work",
        true,
        false,
    );
    assert!(output.allowed.is_empty());
    assert_eq!(
        output.filter_reasons,
        vec![FilterReason::ProviderNotEncrypted]
    );
}

#[test]
fn s3_is_allowed_when_provider_is_local() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S3)],
        "work",
        true,
        false,
    );
    assert_eq!(output.allowed.len(), 1);
    assert_eq!(output.filtered_count, 0);
}

#[test]
fn s3_is_filtered_when_remote_encrypted_without_fallback_opt_in() {
    // S3 is default-local. Encryption alone does not authorize a cloud
    // fallback; the caller must explicitly opt in via allow_s3_cloud_fallback.
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S3)],
        "work",
        false,
        true,
    );
    assert!(output.allowed.is_empty());
    assert_eq!(output.filtered_count, 1);
    assert_eq!(
        output.filter_reasons,
        vec![FilterReason::SensitivityTooHigh {
            claim_sensitivity: Sensitivity::S3,
            max_allowed: Sensitivity::S2,
        }]
    );
}

#[test]
fn s3_is_allowed_when_remote_encrypted_with_fallback_opt_in() {
    let output = run_filter_with_s3_fallback(
        vec![claim_with_sensitivity(Sensitivity::S3)],
        "work",
        false,
        true,
        true,
    );
    assert_eq!(output.allowed.len(), 1);
    assert_eq!(output.filtered_count, 0);
}

#[test]
fn s3_is_filtered_when_remote_with_fallback_opt_in_but_not_encrypted() {
    // The opt-in alone is not enough: a non-local S3 fallback still requires
    // an encrypted provider.
    let output = run_filter_with_s3_fallback(
        vec![claim_with_sensitivity(Sensitivity::S3)],
        "work",
        false,
        false,
        true,
    );
    assert!(output.allowed.is_empty());
    assert_eq!(output.filtered_count, 1);
    assert_eq!(
        output.filter_reasons,
        vec![FilterReason::SensitivityTooHigh {
            claim_sensitivity: Sensitivity::S3,
            max_allowed: Sensitivity::S2,
        }]
    );
}

#[test]
fn s3_is_filtered_when_remote_and_not_encrypted() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S3)],
        "work",
        false,
        false,
    );
    assert!(output.allowed.is_empty());
    assert_eq!(output.filtered_count, 1);
    assert_eq!(
        output.filter_reasons,
        vec![FilterReason::SensitivityTooHigh {
            claim_sensitivity: Sensitivity::S3,
            max_allowed: Sensitivity::S2,
        }]
    );
}

#[test]
fn s4_is_allowed_for_intimate_reflection_when_local() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S4)],
        "intimate_reflection",
        true,
        false,
    );
    assert_eq!(output.allowed.len(), 1);
    assert_eq!(output.filtered_count, 0);
}

#[test]
fn s4_is_filtered_for_heartbeat() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S4)],
        "heartbeat",
        true,
        true,
    );
    assert!(output.allowed.is_empty());
    assert_eq!(
        output.filter_reasons,
        vec![FilterReason::IntentMismatch {
            claim_sensitivity: Sensitivity::S4,
            intent_type: "heartbeat".to_owned(),
        }]
    );
}

#[test]
fn s4_is_filtered_for_briefing() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S4)],
        "briefing",
        true,
        true,
    );
    assert_eq!(output.filtered_count, 1);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn s4_is_filtered_for_work() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S4)],
        "work",
        true,
        true,
    );
    assert_eq!(output.filtered_count, 1);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn s4_is_filtered_for_normal_recall() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S4)],
        "normal_recall",
        true,
        true,
    );
    assert_eq!(output.filtered_count, 1);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn s4_remote_is_filtered_even_with_intimate_reflection() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S4)],
        "intimate_reflection",
        false,
        true,
    );
    assert!(output.allowed.is_empty());
    assert_eq!(output.filter_reasons, vec![FilterReason::ProviderNotLocal]);
}

#[test]
fn s4_remote_heartbeat_is_provider_not_local_first() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S4)],
        "heartbeat",
        false,
        true,
    );
    assert_eq!(output.filter_reasons, vec![FilterReason::ProviderNotLocal]);
}

#[test]
fn mixed_batch_is_partitioned_correctly() {
    // provider_is_local=false, provider_is_encrypted=true, no S3 cloud
    // fallback opt-in: S3 is now filtered too (default-local), on top of the
    // already-filtered S4.
    let claims = vec![
        claim_with_sensitivity(Sensitivity::S0),
        claim_with_sensitivity(Sensitivity::S2),
        claim_with_sensitivity(Sensitivity::S3),
        claim_with_sensitivity(Sensitivity::S4),
        claim_with_sensitivity(Sensitivity::S1),
    ];

    let output = run_filter(claims, "work", false, true);
    assert_eq!(output.allowed.len(), 3);
    assert_eq!(output.filtered_count, 2);
    assert_eq!(
        output.filter_reasons,
        vec![
            FilterReason::SensitivityTooHigh {
                claim_sensitivity: Sensitivity::S3,
                max_allowed: Sensitivity::S2,
            },
            FilterReason::ProviderNotLocal,
        ]
    );
}

#[test]
fn mixed_batch_allows_s3_when_cloud_fallback_opted_in() {
    let claims = vec![
        claim_with_sensitivity(Sensitivity::S0),
        claim_with_sensitivity(Sensitivity::S2),
        claim_with_sensitivity(Sensitivity::S3),
        claim_with_sensitivity(Sensitivity::S4),
        claim_with_sensitivity(Sensitivity::S1),
    ];

    let output = run_filter_with_s3_fallback(claims, "work", false, true, true);
    assert_eq!(output.allowed.len(), 4);
    assert_eq!(output.filtered_count, 1);
    assert_eq!(output.filter_reasons, vec![FilterReason::ProviderNotLocal]);
}

#[test]
fn empty_claims_returns_empty_output() {
    let output = run_filter(vec![], "work", true, true);
    assert!(output.allowed.is_empty());
    assert_eq!(output.filtered_count, 0);
    assert!(output.filter_reasons.is_empty());
}

#[test]
fn all_filtered_count_matches_input_len() {
    let claims = vec![
        claim_with_sensitivity(Sensitivity::S2),
        claim_with_sensitivity(Sensitivity::S3),
        claim_with_sensitivity(Sensitivity::S4),
    ];
    let output = run_filter(claims, "work", false, false);
    assert_eq!(output.allowed.len(), 0);
    assert_eq!(output.filtered_count, 3);
}

#[test]
fn s4_custom_non_intimate_intent_is_filtered() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S4)],
        "journal",
        true,
        true,
    );
    assert_eq!(output.filtered_count, 1);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn s4_intent_check_is_case_sensitive() {
    let output = run_filter(
        vec![claim_with_sensitivity(Sensitivity::S4)],
        "Intimate_Reflection",
        true,
        true,
    );
    assert_eq!(output.filtered_count, 1);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn allowed_claims_preserve_original_order() {
    let mut first = claim_with_sensitivity(Sensitivity::S0);
    first.content = "first".to_owned();
    let mut second = claim_with_sensitivity(Sensitivity::S1);
    second.content = "second".to_owned();

    let output = run_filter(vec![first, second], "work", false, false);
    assert_eq!(output.allowed[0].content, "first");
    assert_eq!(output.allowed[1].content, "second");
}

#[test]
fn filter_reason_count_matches_filtered_count() {
    let claims = vec![
        claim_with_sensitivity(Sensitivity::S2),
        claim_with_sensitivity(Sensitivity::S3),
        claim_with_sensitivity(Sensitivity::S4),
        claim_with_sensitivity(Sensitivity::S4),
    ];
    let output = run_filter(claims, "heartbeat", false, false);
    assert_eq!(output.filter_reasons.len(), output.filtered_count as usize);
}
