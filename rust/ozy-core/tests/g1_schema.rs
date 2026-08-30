use ozy_contracts::{
    AuthorityClass, ClaimData, G1Result, HandlingPolicy, Lifecycle, MemoryType, ProposalData,
    Sensitivity, SourceType, TrustLevel, VerificationState, WriteGateInput,
};
use ozy_core::validate_schema;

fn base_claim() -> ClaimData {
    ClaimData {
        subject: "user:42".to_owned(),
        attribute: Some("city".to_owned()),
        value: "Berlin".to_owned(),
        content: "User lives in Berlin".to_owned(),
        memory_type: MemoryType::Profile,
        authority_class: AuthorityClass::Evidence,
        sensitivity: Sensitivity::S1,
        trust_level: TrustLevel::T3,
        handling_policy: HandlingPolicy::LocalPreferred,
        verification_state: VerificationState::Confirmed,
        confidence: 0.75,
        source_type: SourceType::UserExplicit,
        source_ref: Some("claim-1".to_owned()),
        user_locked: false,
        decay_eligible: true,
        lifecycle: Lifecycle::Permanent,
        valid_from: Some("2026-01-01T00:00:00Z".to_owned()),
        valid_to: None,
    }
}

fn make_input(mutator: impl FnOnce(&mut ClaimData)) -> WriteGateInput {
    let mut claim = base_claim();
    mutator(&mut claim);
    WriteGateInput {
        proposal: ProposalData {
            proposed_claim: claim,
            source_ref: Some("proposal-1".to_owned()),
            source_type: SourceType::UserExplicit,
        },
    }
}

fn assert_schema_valid(input: &WriteGateInput) {
    let result = validate_schema(input).expect("validate_schema should return Ok");
    assert_eq!(result, G1Result::SchemaValid);
}

fn schema_errors(input: &WriteGateInput) -> Vec<String> {
    let result = validate_schema(input).expect("validate_schema should return Ok");
    match result {
        G1Result::SchemaValid => panic!("expected schema errors"),
        G1Result::SchemaError { errors } => errors,
    }
}

#[test]
fn valid_proposal_is_schema_valid() {
    let input = make_input(|_| {});
    assert_schema_valid(&input);
}

#[test]
fn empty_subject_fails() {
    let input = make_input(|c| c.subject = "".to_owned());
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("subject")));
}

#[test]
fn whitespace_subject_fails() {
    let input = make_input(|c| c.subject = "   ".to_owned());
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("subject")));
}

#[test]
fn empty_value_fails() {
    let input = make_input(|c| c.value = "".to_owned());
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("value")));
}

#[test]
fn whitespace_value_fails() {
    let input = make_input(|c| c.value = " \t ".to_owned());
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("value")));
}

#[test]
fn empty_content_fails() {
    let input = make_input(|c| c.content = "".to_owned());
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("content")));
}

#[test]
fn whitespace_content_fails() {
    let input = make_input(|c| c.content = "\n\t".to_owned());
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("content")));
}

#[test]
fn confidence_below_zero_fails() {
    let input = make_input(|c| c.confidence = -0.01);
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("confidence")));
}

#[test]
fn confidence_above_one_fails() {
    let input = make_input(|c| c.confidence = 1.01);
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("confidence")));
}

#[test]
fn confidence_nan_fails() {
    let input = make_input(|c| c.confidence = f64::NAN);
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("confidence")));
}

#[test]
fn confidence_zero_boundary_is_valid() {
    let input = make_input(|c| c.confidence = 0.0);
    assert_schema_valid(&input);
}

#[test]
fn confidence_one_boundary_is_valid() {
    let input = make_input(|c| c.confidence = 1.0);
    assert_schema_valid(&input);
}

#[test]
fn s4_with_s4_isolated_is_valid() {
    let input = make_input(|c| {
        c.sensitivity = Sensitivity::S4;
        c.handling_policy = HandlingPolicy::S4Isolated;
    });
    assert_schema_valid(&input);
}

#[test]
fn s4_with_local_only_fails() {
    let input = make_input(|c| {
        c.sensitivity = Sensitivity::S4;
        c.handling_policy = HandlingPolicy::LocalOnly;
    });
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("S4")));
}

#[test]
fn s4_with_cloud_ok_encrypted_fails() {
    let input = make_input(|c| {
        c.sensitivity = Sensitivity::S4;
        c.handling_policy = HandlingPolicy::CloudOkEncrypted;
    });
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("S4")));
}

#[test]
fn s3_with_local_only_is_valid() {
    let input = make_input(|c| {
        c.sensitivity = Sensitivity::S3;
        c.handling_policy = HandlingPolicy::LocalOnly;
    });
    assert_schema_valid(&input);
}

#[test]
fn s3_with_local_preferred_is_valid() {
    let input = make_input(|c| {
        c.sensitivity = Sensitivity::S3;
        c.handling_policy = HandlingPolicy::LocalPreferred;
    });
    assert_schema_valid(&input);
}

#[test]
fn s3_with_cloud_ok_encrypted_fails() {
    let input = make_input(|c| {
        c.sensitivity = Sensitivity::S3;
        c.handling_policy = HandlingPolicy::CloudOkEncrypted;
    });
    let errors = schema_errors(&input);
    assert!(errors.iter().any(|e| e.contains("S3")));
}

#[test]
fn s0_with_cloud_ok_encrypted_is_valid() {
    let input = make_input(|c| {
        c.sensitivity = Sensitivity::S0;
        c.handling_policy = HandlingPolicy::CloudOkEncrypted;
    });
    assert_schema_valid(&input);
}

#[test]
fn multiple_validation_errors_are_collected() {
    let input = make_input(|c| {
        c.subject = "".to_owned();
        c.value = "  ".to_owned();
        c.content = "\n".to_owned();
        c.confidence = 2.0;
        c.sensitivity = Sensitivity::S4;
        c.handling_policy = HandlingPolicy::LocalPreferred;
    });
    let errors = schema_errors(&input);
    assert!(errors.len() >= 5);
    assert!(errors.iter().any(|e| e.contains("subject")));
    assert!(errors.iter().any(|e| e.contains("value")));
    assert!(errors.iter().any(|e| e.contains("content")));
    assert!(errors.iter().any(|e| e.contains("confidence")));
    assert!(errors.iter().any(|e| e.contains("S4")));
}
