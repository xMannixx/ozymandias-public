use ozy_contracts::{
    ApprovalClass, Sensitivity, TaintActionCheck, TaintDecision, TaintSummary, TrustLevel,
};
use ozy_core::check_tainted_action;

fn summary(
    effective_trust: TrustLevel,
    effective_sensitivity: Sensitivity,
    is_tainted: bool,
) -> TaintSummary {
    TaintSummary {
        effective_trust,
        effective_sensitivity,
        is_tainted,
        taint_sources: vec!["chunk-1".to_owned()],
    }
}

fn check(
    effective_trust: TrustLevel,
    effective_sensitivity: Sensitivity,
    is_tainted: bool,
    proposed_class: ApprovalClass,
) -> TaintDecision {
    let input = TaintActionCheck {
        taint_summary: summary(effective_trust, effective_sensitivity, is_tainted),
        proposed_class,
    };
    check_tainted_action(&input).expect("check_tainted_action should return Ok")
}

#[test]
fn not_tainted_class0_proceeds() {
    assert_eq!(
        check(
            TrustLevel::T3,
            Sensitivity::S1,
            false,
            ApprovalClass::Class0
        ),
        TaintDecision::Proceed
    );
}

#[test]
fn t0_tainted_class0_proceeds() {
    assert_eq!(
        check(TrustLevel::T0, Sensitivity::S0, true, ApprovalClass::Class0),
        TaintDecision::Proceed
    );
}

#[test]
fn t0_tainted_class1_proceeds() {
    assert_eq!(
        check(TrustLevel::T0, Sensitivity::S0, true, ApprovalClass::Class1),
        TaintDecision::Proceed
    );
}

#[test]
fn t0_tainted_class2_blocks() {
    assert!(matches!(
        check(TrustLevel::T0, Sensitivity::S0, true, ApprovalClass::Class2),
        TaintDecision::Block { .. }
    ));
}

#[test]
fn t0_tainted_class3_blocks() {
    assert!(matches!(
        check(TrustLevel::T0, Sensitivity::S0, true, ApprovalClass::Class3),
        TaintDecision::Block { .. }
    ));
}

#[test]
fn t0_tainted_class4_blocks() {
    assert!(matches!(
        check(TrustLevel::T0, Sensitivity::S0, true, ApprovalClass::Class4),
        TaintDecision::Block { .. }
    ));
}

#[test]
fn s4_tainted_class0_escalates_to_class4() {
    assert_eq!(
        check(TrustLevel::T3, Sensitivity::S4, true, ApprovalClass::Class0),
        TaintDecision::Escalate {
            new_class: ApprovalClass::Class4,
            reason: "taint escalation required".to_owned()
        }
    );
}

#[test]
fn s4_tainted_class3_escalates_to_class4() {
    assert_eq!(
        check(TrustLevel::T3, Sensitivity::S4, true, ApprovalClass::Class3),
        TaintDecision::Escalate {
            new_class: ApprovalClass::Class4,
            reason: "taint escalation required".to_owned()
        }
    );
}

#[test]
fn s4_tainted_class4_proceeds() {
    assert_eq!(
        check(TrustLevel::T3, Sensitivity::S4, true, ApprovalClass::Class4),
        TaintDecision::Proceed
    );
}

#[test]
fn s3_tainted_class0_escalates_to_class3() {
    assert_eq!(
        check(TrustLevel::T3, Sensitivity::S3, true, ApprovalClass::Class0),
        TaintDecision::Escalate {
            new_class: ApprovalClass::Class3,
            reason: "taint escalation required".to_owned()
        }
    );
}

#[test]
fn s3_tainted_class2_escalates_to_class3() {
    assert_eq!(
        check(TrustLevel::T3, Sensitivity::S3, true, ApprovalClass::Class2),
        TaintDecision::Escalate {
            new_class: ApprovalClass::Class3,
            reason: "taint escalation required".to_owned()
        }
    );
}

#[test]
fn s3_tainted_class3_proceeds() {
    assert_eq!(
        check(TrustLevel::T3, Sensitivity::S3, true, ApprovalClass::Class3),
        TaintDecision::Proceed
    );
}

#[test]
fn t1_tainted_class0_escalates_to_class2() {
    assert_eq!(
        check(TrustLevel::T1, Sensitivity::S1, true, ApprovalClass::Class0),
        TaintDecision::Escalate {
            new_class: ApprovalClass::Class2,
            reason: "taint escalation required".to_owned()
        }
    );
}

#[test]
fn t1_tainted_class1_escalates_to_class2() {
    assert_eq!(
        check(TrustLevel::T1, Sensitivity::S1, true, ApprovalClass::Class1),
        TaintDecision::Escalate {
            new_class: ApprovalClass::Class2,
            reason: "taint escalation required".to_owned()
        }
    );
}

#[test]
fn t1_tainted_class2_proceeds() {
    assert_eq!(
        check(TrustLevel::T1, Sensitivity::S1, true, ApprovalClass::Class2),
        TaintDecision::Proceed
    );
}

#[test]
fn escalation_reason_mentions_taint_or_signal() {
    let result = check(TrustLevel::T1, Sensitivity::S1, true, ApprovalClass::Class0);
    match result {
        TaintDecision::Escalate { reason, .. } => {
            let lower = reason.to_lowercase();
            assert!(
                lower.contains("taint") || lower.contains("trust") || lower.contains("sensitivity")
            );
        }
        other => panic!("expected escalate decision, got: {other:?}"),
    }
}

#[test]
fn block_reason_mentions_t0_or_untrusted() {
    let result = check(TrustLevel::T0, Sensitivity::S0, true, ApprovalClass::Class3);
    match result {
        TaintDecision::Block { reason } => {
            let lower = reason.to_lowercase();
            assert!(lower.contains("t0") || lower.contains("untrusted"));
        }
        other => panic!("expected block decision, got: {other:?}"),
    }
}
