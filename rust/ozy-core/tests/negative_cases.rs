use ozy_contracts::{
    ApprovalClass, Channel, ClaimData, FilterReason, HandlingPolicy, Lifecycle, MemoryType,
    PayloadSensitivityInput, PayloadSensitivityResult, Sensitivity, SensitivityFilterInput,
    SourceType, TrustLevel, VerificationState,
};
use ozy_core::{check_payload_sensitivity, filter_claims};

fn mk_claim(sensitivity: Sensitivity) -> ClaimData {
    ClaimData {
        subject: "subject".to_owned(),
        attribute: Some("attr".to_owned()),
        value: "value".to_owned(),
        content: "content".to_owned(),
        memory_type: MemoryType::Profile,
        sensitivity,
        trust_level: TrustLevel::T2,
        handling_policy: HandlingPolicy::LocalPreferred,
        verification_state: VerificationState::Tentative,
        confidence: 0.5,
        source_type: SourceType::ModelInferred,
        source_ref: Some("source".to_owned()),
        user_locked: false,
        decay_eligible: true,
        lifecycle: Lifecycle::Temporary,
        valid_from: None,
        valid_to: None,
    }
}

fn run_filter(
    intent_type: &str,
    provider_is_local: bool,
    provider_is_encrypted: bool,
) -> ozy_contracts::SensitivityFilterOutput {
    let input = SensitivityFilterInput {
        claims: vec![mk_claim(Sensitivity::S4)],
        intent_type: intent_type.to_owned(),
        provider_is_local,
        provider_is_encrypted,
        allow_s3_cloud_fallback: false,
    };
    filter_claims(&input).expect("filter should not error")
}

#[test]
fn s4_heartbeat_is_rejected() {
    let output = run_filter("heartbeat", true, true);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn s4_briefing_is_rejected() {
    let output = run_filter("briefing", true, true);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn s4_work_is_rejected() {
    let output = run_filter("work", true, true);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn s4_normal_recall_is_rejected() {
    let output = run_filter("normal_recall", true, true);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn s4_planning_is_rejected() {
    let output = run_filter("planning", true, true);
    assert!(matches!(
        output.filter_reasons[0],
        FilterReason::IntentMismatch { .. }
    ));
}

#[test]
fn s4_multiple_wrong_intent_claims_all_filtered() {
    let input = SensitivityFilterInput {
        claims: vec![
            mk_claim(Sensitivity::S4),
            mk_claim(Sensitivity::S4),
            mk_claim(Sensitivity::S4),
        ],
        intent_type: "work".to_owned(),
        provider_is_local: true,
        provider_is_encrypted: true,
        allow_s3_cloud_fallback: false,
    };

    let output = filter_claims(&input).expect("filter should not error");
    assert!(output.allowed.is_empty());
    assert_eq!(output.filtered_count, 3);
    assert_eq!(output.filter_reasons.len(), 3);
}

#[test]
fn s3_remote_unencrypted_is_rejected() {
    let input = SensitivityFilterInput {
        claims: vec![mk_claim(Sensitivity::S3)],
        intent_type: "work".to_owned(),
        provider_is_local: false,
        provider_is_encrypted: false,
        allow_s3_cloud_fallback: false,
    };

    let output = filter_claims(&input).expect("filter should not error");
    assert_eq!(
        output.filter_reasons,
        vec![FilterReason::SensitivityTooHigh {
            claim_sensitivity: Sensitivity::S3,
            max_allowed: Sensitivity::S2,
        }]
    );
}

#[test]
fn filtered_count_always_matches_filter_reason_len() {
    let input = SensitivityFilterInput {
        claims: vec![
            mk_claim(Sensitivity::S2),
            mk_claim(Sensitivity::S3),
            mk_claim(Sensitivity::S4),
            mk_claim(Sensitivity::S4),
        ],
        intent_type: "briefing".to_owned(),
        provider_is_local: false,
        provider_is_encrypted: false,
        allow_s3_cloud_fallback: false,
    };

    let output = filter_claims(&input).expect("filter should not error");
    assert_eq!(output.filtered_count as usize, output.filter_reasons.len());
}

#[test]
fn s3_remote_encrypted_with_fallback_opt_in_is_allowed() {
    let input = SensitivityFilterInput {
        claims: vec![mk_claim(Sensitivity::S3)],
        intent_type: "work".to_owned(),
        provider_is_local: false,
        provider_is_encrypted: true,
        allow_s3_cloud_fallback: true,
    };

    let output = filter_claims(&input).expect("filter should not error");
    assert_eq!(output.allowed.len(), 1);
    assert_eq!(output.filtered_count, 0);
}

#[test]
fn s3_remote_encrypted_without_fallback_opt_in_is_rejected() {
    let input = SensitivityFilterInput {
        claims: vec![mk_claim(Sensitivity::S3)],
        intent_type: "work".to_owned(),
        provider_is_local: false,
        provider_is_encrypted: true,
        allow_s3_cloud_fallback: false,
    };

    let output = filter_claims(&input).expect("filter should not error");
    assert_eq!(
        output.filter_reasons,
        vec![FilterReason::SensitivityTooHigh {
            claim_sensitivity: Sensitivity::S3,
            max_allowed: Sensitivity::S2,
        }]
    );
}

#[test]
fn warning_message_mentions_s4_and_remote_write() {
    let input = PayloadSensitivityInput {
        action_class: ApprovalClass::Class3,
        payload_sensitivity: Sensitivity::S4,
        target_channel: Channel::Web,
    };

    let result = check_payload_sensitivity(&input).expect("payload check should not error");
    match result {
        PayloadSensitivityResult::Warning { message } => {
            assert!(message.to_lowercase().contains("s4"));
            assert!(message.to_lowercase().contains("remote"));
        }
        _ => panic!("expected warning for s4 class3"),
    }
}

#[test]
fn s3_remote_escalation_never_drops_class() {
    let input = PayloadSensitivityInput {
        action_class: ApprovalClass::Class4,
        payload_sensitivity: Sensitivity::S3,
        target_channel: Channel::Web,
    };

    let result = check_payload_sensitivity(&input).expect("payload check should not error");
    assert_eq!(
        result,
        PayloadSensitivityResult::Escalated {
            new_class: ApprovalClass::Class4,
        }
    );
}
