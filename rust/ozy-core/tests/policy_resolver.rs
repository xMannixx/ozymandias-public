use ozy_contracts::{
    ApprovalClass, ApprovalDecision, ApprovalRequest, AuthorityLevel, Sensitivity,
};
use ozy_core::resolve_approval;

fn make_request(
    approval_class: ApprovalClass,
    authority_level: AuthorityLevel,
    payload_preview: Option<&str>,
    payload_sensitivity: Option<Sensitivity>,
) -> ApprovalRequest {
    ApprovalRequest {
        action_type: "test_action".to_owned(),
        approval_class,
        payload_preview: payload_preview.map(str::to_owned),
        authority_level,
        payload_sensitivity,
    }
}

fn decision(request: ApprovalRequest) -> ApprovalDecision {
    resolve_approval(&request).expect("resolve_approval should return Ok")
}

fn assert_approved(request: ApprovalRequest) {
    assert_eq!(decision(request), ApprovalDecision::Approved);
}

fn assert_denied(request: ApprovalRequest) {
    assert!(matches!(decision(request), ApprovalDecision::Denied { .. }));
}

fn assert_escalated_to(request: ApprovalRequest, new_class: ApprovalClass) {
    assert_eq!(
        decision(request),
        ApprovalDecision::EscalatedTo { new_class }
    );
}

fn denied_reason(request: ApprovalRequest) -> String {
    match decision(request) {
        ApprovalDecision::Denied { reason } => reason,
        other => panic!("expected denied decision, got: {other:?}"),
    }
}

#[test]
fn class0_a0_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class0,
        AuthorityLevel::A0,
        None,
        None,
    ));
}

#[test]
fn class0_a1_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class0,
        AuthorityLevel::A1,
        None,
        None,
    ));
}

#[test]
fn class0_a2_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class0,
        AuthorityLevel::A2,
        None,
        None,
    ));
}

#[test]
fn class1_a0_is_denied() {
    assert_denied(make_request(
        ApprovalClass::Class1,
        AuthorityLevel::A0,
        None,
        None,
    ));
}

#[test]
fn class1_a1_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class1,
        AuthorityLevel::A1,
        None,
        None,
    ));
}

#[test]
fn class1_a2_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class1,
        AuthorityLevel::A2,
        None,
        None,
    ));
}

#[test]
fn class2_a0_is_denied() {
    assert_denied(make_request(
        ApprovalClass::Class2,
        AuthorityLevel::A0,
        None,
        None,
    ));
}

#[test]
fn class2_a1_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class2,
        AuthorityLevel::A1,
        None,
        None,
    ));
}

#[test]
fn class2_a2_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class2,
        AuthorityLevel::A2,
        None,
        None,
    ));
}

#[test]
fn class3_a0_with_preview_is_denied() {
    assert_denied(make_request(
        ApprovalClass::Class3,
        AuthorityLevel::A0,
        Some("preview"),
        None,
    ));
}

#[test]
fn class3_a1_without_preview_is_denied() {
    assert_denied(make_request(
        ApprovalClass::Class3,
        AuthorityLevel::A1,
        None,
        None,
    ));
}

#[test]
fn class3_a1_with_preview_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class3,
        AuthorityLevel::A1,
        Some("preview"),
        None,
    ));
}

#[test]
fn class3_a2_without_preview_is_denied() {
    assert_denied(make_request(
        ApprovalClass::Class3,
        AuthorityLevel::A2,
        None,
        None,
    ));
}

#[test]
fn class3_a2_with_preview_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class3,
        AuthorityLevel::A2,
        Some("preview"),
        None,
    ));
}

#[test]
fn class3_a1_empty_preview_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class3,
        AuthorityLevel::A1,
        Some(""),
        None,
    ));
}

#[test]
fn class4_a0_is_denied() {
    assert_denied(make_request(
        ApprovalClass::Class4,
        AuthorityLevel::A0,
        Some("preview"),
        None,
    ));
}

#[test]
fn class4_a1_is_denied() {
    assert_denied(make_request(
        ApprovalClass::Class4,
        AuthorityLevel::A1,
        Some("preview"),
        None,
    ));
}

#[test]
fn class4_a2_is_approved() {
    assert_approved(make_request(
        ApprovalClass::Class4,
        AuthorityLevel::A2,
        Some("preview"),
        None,
    ));
}

#[test]
fn class0_with_s3_escalates_to_class3() {
    assert_escalated_to(
        make_request(
            ApprovalClass::Class0,
            AuthorityLevel::A2,
            None,
            Some(Sensitivity::S3),
        ),
        ApprovalClass::Class3,
    );
}

#[test]
fn class0_with_s4_escalates_to_class4() {
    assert_escalated_to(
        make_request(
            ApprovalClass::Class0,
            AuthorityLevel::A2,
            None,
            Some(Sensitivity::S4),
        ),
        ApprovalClass::Class4,
    );
}

#[test]
fn class1_with_s3_escalates_to_class3() {
    assert_escalated_to(
        make_request(
            ApprovalClass::Class1,
            AuthorityLevel::A2,
            None,
            Some(Sensitivity::S3),
        ),
        ApprovalClass::Class3,
    );
}

#[test]
fn class1_with_s4_escalates_to_class4() {
    assert_escalated_to(
        make_request(
            ApprovalClass::Class1,
            AuthorityLevel::A2,
            None,
            Some(Sensitivity::S4),
        ),
        ApprovalClass::Class4,
    );
}

#[test]
fn class2_with_s3_escalates_to_class3() {
    assert_escalated_to(
        make_request(
            ApprovalClass::Class2,
            AuthorityLevel::A2,
            None,
            Some(Sensitivity::S3),
        ),
        ApprovalClass::Class3,
    );
}

#[test]
fn class2_with_s4_escalates_to_class4() {
    assert_escalated_to(
        make_request(
            ApprovalClass::Class2,
            AuthorityLevel::A2,
            None,
            Some(Sensitivity::S4),
        ),
        ApprovalClass::Class4,
    );
}

#[test]
fn class3_with_s3_has_no_escalation_and_applies_class3_rules() {
    assert_approved(make_request(
        ApprovalClass::Class3,
        AuthorityLevel::A1,
        Some("preview"),
        Some(Sensitivity::S3),
    ));
}

#[test]
fn class3_with_s4_escalates_to_class4() {
    assert_escalated_to(
        make_request(
            ApprovalClass::Class3,
            AuthorityLevel::A2,
            Some("preview"),
            Some(Sensitivity::S4),
        ),
        ApprovalClass::Class4,
    );
}

#[test]
fn class4_with_s4_has_no_escalation_and_applies_class4_rules() {
    assert_approved(make_request(
        ApprovalClass::Class4,
        AuthorityLevel::A2,
        Some("preview"),
        Some(Sensitivity::S4),
    ));
}

#[test]
fn class4_with_s3_has_no_escalation_and_applies_class4_rules() {
    assert_denied(make_request(
        ApprovalClass::Class4,
        AuthorityLevel::A1,
        Some("preview"),
        Some(Sensitivity::S3),
    ));
}

#[test]
fn none_payload_sensitivity_uses_normal_rules() {
    assert_approved(make_request(
        ApprovalClass::Class1,
        AuthorityLevel::A1,
        None,
        None,
    ));
}

#[test]
fn s0_payload_sensitivity_does_not_escalate() {
    assert_approved(make_request(
        ApprovalClass::Class1,
        AuthorityLevel::A1,
        None,
        Some(Sensitivity::S0),
    ));
}

#[test]
fn s1_payload_sensitivity_does_not_escalate() {
    assert_approved(make_request(
        ApprovalClass::Class2,
        AuthorityLevel::A1,
        None,
        Some(Sensitivity::S1),
    ));
}

#[test]
fn s2_payload_sensitivity_does_not_escalate() {
    assert_denied(make_request(
        ApprovalClass::Class2,
        AuthorityLevel::A0,
        None,
        Some(Sensitivity::S2),
    ));
}

#[test]
fn class1_a0_denied_reason_mentions_authority() {
    let reason = denied_reason(make_request(
        ApprovalClass::Class1,
        AuthorityLevel::A0,
        None,
        None,
    ));
    assert!(reason.to_lowercase().contains("authority"));
}

#[test]
fn class3_missing_preview_denied_reason_mentions_payload_preview() {
    let reason = denied_reason(make_request(
        ApprovalClass::Class3,
        AuthorityLevel::A1,
        None,
        None,
    ));
    assert!(reason.contains("payload_preview"));
}

#[test]
fn class4_a1_denied_reason_mentions_a2_or_authority() {
    let reason = denied_reason(make_request(
        ApprovalClass::Class4,
        AuthorityLevel::A1,
        Some("preview"),
        None,
    ));
    let lower = reason.to_lowercase();
    assert!(lower.contains("a2") || lower.contains("authority"));
}
