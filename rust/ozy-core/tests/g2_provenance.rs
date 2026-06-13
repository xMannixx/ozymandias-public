use ozy_contracts::{
    ClaimData, G2Result, HandlingPolicy, Lifecycle, MemoryType, ProposalData, Sensitivity,
    SourceType, TrustLevel, VerificationState,
};
use ozy_core::check_provenance;

fn base_proposal(source_type: SourceType) -> ProposalData {
    ProposalData {
        proposed_claim: ClaimData {
            subject: "user:42".to_owned(),
            attribute: Some("timezone".to_owned()),
            value: "Europe/Berlin".to_owned(),
            content: "Timezone preference".to_owned(),
            memory_type: MemoryType::Preference,
            sensitivity: Sensitivity::S1,
            trust_level: TrustLevel::T2,
            handling_policy: HandlingPolicy::LocalPreferred,
            verification_state: VerificationState::Tentative,
            confidence: 0.6,
            source_type,
            source_ref: Some("claim-source".to_owned()),
            user_locked: false,
            decay_eligible: true,
            lifecycle: Lifecycle::Temporary,
            valid_from: None,
            valid_to: None,
        },
        source_ref: Some("proposal-source".to_owned()),
        source_type,
    }
}

#[test]
fn user_explicit_is_auto_confirm_eligible() {
    let proposal = base_proposal(SourceType::UserExplicit);
    let result = check_provenance(&proposal).expect("check_provenance should succeed");
    assert_eq!(
        result,
        G2Result {
            auto_confirm_eligible: true,
            locked_to_tentative: false,
        }
    );
}

#[test]
fn user_confirmed_is_auto_confirm_eligible() {
    let proposal = base_proposal(SourceType::UserConfirmed);
    let result = check_provenance(&proposal).expect("check_provenance should succeed");
    assert_eq!(
        result,
        G2Result {
            auto_confirm_eligible: true,
            locked_to_tentative: false,
        }
    );
}

#[test]
fn model_inferred_is_locked_to_tentative() {
    let proposal = base_proposal(SourceType::ModelInferred);
    let result = check_provenance(&proposal).expect("check_provenance should succeed");
    assert_eq!(
        result,
        G2Result {
            auto_confirm_eligible: false,
            locked_to_tentative: true,
        }
    );
}

#[test]
fn connector_data_is_locked_to_tentative() {
    let proposal = base_proposal(SourceType::ConnectorData);
    let result = check_provenance(&proposal).expect("check_provenance should succeed");
    assert_eq!(
        result,
        G2Result {
            auto_confirm_eligible: false,
            locked_to_tentative: true,
        }
    );
}

#[test]
fn user_explicit_matrix_flags_are_exact() {
    let proposal = base_proposal(SourceType::UserExplicit);
    let result = check_provenance(&proposal).expect("check_provenance should succeed");
    assert!(result.auto_confirm_eligible);
    assert!(!result.locked_to_tentative);
}

#[test]
fn user_confirmed_matrix_flags_are_exact() {
    let proposal = base_proposal(SourceType::UserConfirmed);
    let result = check_provenance(&proposal).expect("check_provenance should succeed");
    assert!(result.auto_confirm_eligible);
    assert!(!result.locked_to_tentative);
}

#[test]
fn model_inferred_matrix_flags_are_exact() {
    let proposal = base_proposal(SourceType::ModelInferred);
    let result = check_provenance(&proposal).expect("check_provenance should succeed");
    assert!(!result.auto_confirm_eligible);
    assert!(result.locked_to_tentative);
}

#[test]
fn connector_data_matrix_flags_are_exact() {
    let proposal = base_proposal(SourceType::ConnectorData);
    let result = check_provenance(&proposal).expect("check_provenance should succeed");
    assert!(!result.auto_confirm_eligible);
    assert!(result.locked_to_tentative);
}

#[test]
fn proposal_source_type_drives_result_not_claim_source_type() {
    let mut proposal = base_proposal(SourceType::UserExplicit);
    proposal.proposed_claim.source_type = SourceType::ModelInferred;
    let result = check_provenance(&proposal).expect("check_provenance should succeed");
    assert_eq!(
        result,
        G2Result {
            auto_confirm_eligible: true,
            locked_to_tentative: false,
        }
    );
}

#[test]
fn provenance_check_never_errors_for_supported_source_types() {
    let source_types = [
        SourceType::UserExplicit,
        SourceType::UserConfirmed,
        SourceType::ModelInferred,
        SourceType::ConnectorData,
    ];

    for source_type in source_types {
        let proposal = base_proposal(source_type);
        assert!(check_provenance(&proposal).is_ok());
    }
}
