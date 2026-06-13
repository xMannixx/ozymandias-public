use ozy_contracts::{
    ApprovalClass, Channel, PayloadSensitivityInput, PayloadSensitivityResult, Sensitivity,
};
use ozy_core::check_payload_sensitivity;

fn run_payload_check(
    action_class: ApprovalClass,
    payload_sensitivity: Sensitivity,
    target_channel: Channel,
) -> PayloadSensitivityResult {
    let input = PayloadSensitivityInput {
        action_class,
        payload_sensitivity,
        target_channel,
    };

    check_payload_sensitivity(&input).expect("check_payload_sensitivity should not error")
}

#[test]
fn s0_is_always_allowed() {
    let result = run_payload_check(ApprovalClass::Class4, Sensitivity::S0, Channel::Web);
    assert_eq!(result, PayloadSensitivityResult::Allowed);
}

#[test]
fn s1_is_always_allowed() {
    let result = run_payload_check(ApprovalClass::Class3, Sensitivity::S1, Channel::Telegram);
    assert_eq!(result, PayloadSensitivityResult::Allowed);
}

#[test]
fn s2_is_always_allowed() {
    let result = run_payload_check(ApprovalClass::Class0, Sensitivity::S2, Channel::System);
    assert_eq!(result, PayloadSensitivityResult::Allowed);
}

#[test]
fn s3_on_system_channel_is_allowed() {
    let result = run_payload_check(ApprovalClass::Class2, Sensitivity::S3, Channel::System);
    assert_eq!(result, PayloadSensitivityResult::Allowed);
}

#[test]
fn s3_on_celery_channel_is_allowed() {
    let result = run_payload_check(ApprovalClass::Class1, Sensitivity::S3, Channel::Celery);
    assert_eq!(result, PayloadSensitivityResult::Allowed);
}

#[test]
fn s3_on_web_channel_escalates_to_class3() {
    let result = run_payload_check(ApprovalClass::Class1, Sensitivity::S3, Channel::Web);
    assert_eq!(
        result,
        PayloadSensitivityResult::Escalated {
            new_class: ApprovalClass::Class3,
        }
    );
}

#[test]
fn s3_on_telegram_channel_escalates_to_class3() {
    let result = run_payload_check(ApprovalClass::Class0, Sensitivity::S3, Channel::Telegram);
    assert_eq!(
        result,
        PayloadSensitivityResult::Escalated {
            new_class: ApprovalClass::Class3,
        }
    );
}

#[test]
fn s3_remote_keeps_higher_existing_class() {
    let result = run_payload_check(ApprovalClass::Class4, Sensitivity::S3, Channel::Web);
    assert_eq!(
        result,
        PayloadSensitivityResult::Escalated {
            new_class: ApprovalClass::Class4,
        }
    );
}

#[test]
fn s4_with_remote_write_class3_returns_warning() {
    let result = run_payload_check(ApprovalClass::Class3, Sensitivity::S4, Channel::Web);
    assert!(matches!(result, PayloadSensitivityResult::Warning { .. }));
}

#[test]
fn s4_with_remote_write_class4_returns_warning() {
    let result = run_payload_check(ApprovalClass::Class4, Sensitivity::S4, Channel::Telegram);
    assert!(matches!(result, PayloadSensitivityResult::Warning { .. }));
}

#[test]
fn s4_with_class3_on_system_still_returns_warning() {
    let result = run_payload_check(ApprovalClass::Class3, Sensitivity::S4, Channel::System);
    assert!(matches!(result, PayloadSensitivityResult::Warning { .. }));
}

#[test]
fn s4_non_local_with_class0_escalates_to_class4() {
    let result = run_payload_check(ApprovalClass::Class0, Sensitivity::S4, Channel::Web);
    assert_eq!(
        result,
        PayloadSensitivityResult::Escalated {
            new_class: ApprovalClass::Class4,
        }
    );
}

#[test]
fn s4_non_local_with_class1_escalates_to_class4() {
    let result = run_payload_check(ApprovalClass::Class1, Sensitivity::S4, Channel::Telegram);
    assert_eq!(
        result,
        PayloadSensitivityResult::Escalated {
            new_class: ApprovalClass::Class4,
        }
    );
}

#[test]
fn s4_local_system_with_class0_is_allowed() {
    let result = run_payload_check(ApprovalClass::Class0, Sensitivity::S4, Channel::System);
    assert_eq!(result, PayloadSensitivityResult::Allowed);
}

#[test]
fn s4_local_celery_with_class2_is_allowed() {
    let result = run_payload_check(ApprovalClass::Class2, Sensitivity::S4, Channel::Celery);
    assert_eq!(result, PayloadSensitivityResult::Allowed);
}
