use ozy_contracts::{
    AuthorityClass, ClaimData, ConflictResult, G3Result, HandlingPolicy, Lifecycle, OzyError,
    ProposalData, Sensitivity, SourceType, TrustLevel, VerificationState,
};
use ozy_core::detect_conflicts;

fn proposed_claim(
    subject: &str,
    attribute: Option<&str>,
    valid_from: Option<&str>,
    source_ref: Option<&str>,
) -> ClaimData {
    ClaimData {
        subject: subject.to_owned(),
        attribute: attribute.map(str::to_owned),
        value: "new-value".to_owned(),
        content: "new content".to_owned(),
        memory_type: ozy_contracts::MemoryType::Profile,
        authority_class: AuthorityClass::Evidence,
        sensitivity: Sensitivity::S1,
        trust_level: TrustLevel::T2,
        handling_policy: HandlingPolicy::LocalPreferred,
        verification_state: VerificationState::Tentative,
        confidence: 0.7,
        source_type: SourceType::UserExplicit,
        source_ref: source_ref.map(str::to_owned),
        user_locked: false,
        decay_eligible: true,
        lifecycle: Lifecycle::Permanent,
        valid_from: valid_from.map(str::to_owned),
        valid_to: None,
    }
}

fn existing_claim(
    subject: &str,
    attribute: Option<&str>,
    valid_from: Option<&str>,
    source_ref: Option<&str>,
    user_locked: bool,
) -> ClaimData {
    ClaimData {
        subject: subject.to_owned(),
        attribute: attribute.map(str::to_owned),
        value: "old-value".to_owned(),
        content: "old content".to_owned(),
        memory_type: ozy_contracts::MemoryType::Profile,
        authority_class: AuthorityClass::Evidence,
        sensitivity: Sensitivity::S1,
        trust_level: TrustLevel::T3,
        handling_policy: HandlingPolicy::LocalPreferred,
        verification_state: VerificationState::Confirmed,
        confidence: 0.8,
        source_type: SourceType::UserConfirmed,
        source_ref: source_ref.map(str::to_owned),
        user_locked,
        decay_eligible: false,
        lifecycle: Lifecycle::Permanent,
        valid_from: valid_from.map(str::to_owned),
        valid_to: None,
    }
}

fn proposal_for(claim: ClaimData) -> ProposalData {
    ProposalData {
        proposed_claim: claim,
        source_ref: Some("proposal-ref".to_owned()),
        source_type: SourceType::UserExplicit,
    }
}

#[test]
fn no_existing_claims_returns_no_conflict() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let result = detect_conflicts(&proposal, &[]).expect("detect_conflicts should succeed");
    assert_eq!(
        result,
        G3Result {
            result: ConflictResult::NoConflict,
            matched_claim_id: None,
        }
    );
}

#[test]
fn different_subject_does_not_conflict() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing = vec![existing_claim(
        "user:99",
        Some("city"),
        None,
        Some("id-1"),
        false,
    )];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.result, ConflictResult::NoConflict);
}

#[test]
fn same_subject_different_attribute_does_not_conflict() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing = vec![existing_claim(
        "user:42",
        Some("country"),
        None,
        Some("id-1"),
        false,
    )];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.result, ConflictResult::NoConflict);
}

#[test]
fn same_subject_same_attribute_without_dates_creates_conflict_group() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        None,
        Some("id-1"),
        false,
    )];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(
        result,
        G3Result {
            result: ConflictResult::ConflictGroup {
                claim_ids: vec!["id-1".to_owned()],
            },
            matched_claim_id: None,
        }
    );
}

#[test]
fn both_none_attributes_are_considered_matching() {
    let proposal = proposal_for(proposed_claim("user:42", None, None, Some("p1")));
    let existing = vec![existing_claim("user:42", None, None, Some("id-1"), false)];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(
        result.result,
        ConflictResult::ConflictGroup {
            claim_ids: vec!["id-1".to_owned()]
        }
    );
}

#[test]
fn proposed_none_attribute_and_existing_some_do_not_match() {
    let proposal = proposal_for(proposed_claim("user:42", None, None, Some("p1")));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        None,
        Some("id-1"),
        false,
    )];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.result, ConflictResult::NoConflict);
}

#[test]
fn proposed_some_attribute_and_existing_none_do_not_match() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing = vec![existing_claim("user:42", None, None, Some("id-1"), false)];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.result, ConflictResult::NoConflict);
}

#[test]
fn locked_matching_claim_returns_invariant_violation() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        None,
        Some("id-1"),
        true,
    )];

    let result = detect_conflicts(&proposal, &existing);
    assert!(matches!(
        result,
        Err(OzyError::InvariantViolation { message }) if message.contains("locked")
    ));
}

#[test]
fn any_locked_match_in_multiple_claims_returns_invariant_violation() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing = vec![
        existing_claim("user:42", Some("city"), None, Some("id-1"), false),
        existing_claim("user:42", Some("city"), None, Some("id-2"), true),
    ];

    let result = detect_conflicts(&proposal, &existing);
    assert!(matches!(result, Err(OzyError::InvariantViolation { .. })));
}

#[test]
fn newer_proposed_valid_from_creates_temporal_succession() {
    let proposal = proposal_for(proposed_claim(
        "user:42",
        Some("city"),
        Some("2026-02-01T00:00:00Z"),
        Some("p1"),
    ));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        Some("2026-01-01T00:00:00Z"),
        Some("id-older"),
        false,
    )];

    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(
        result,
        G3Result {
            result: ConflictResult::TemporalSuccession,
            matched_claim_id: Some("id-older".to_owned()),
        }
    );
}

#[test]
fn newer_proposed_with_existing_without_valid_from_is_temporal_succession() {
    let proposal = proposal_for(proposed_claim(
        "user:42",
        Some("city"),
        Some("2026-02-01T00:00:00Z"),
        Some("p1"),
    ));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        None,
        Some("id-1"),
        false,
    )];

    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.result, ConflictResult::TemporalSuccession);
}

#[test]
fn older_proposed_valid_from_creates_conflict_group() {
    let proposal = proposal_for(proposed_claim(
        "user:42",
        Some("city"),
        Some("2026-01-01T00:00:00Z"),
        Some("p1"),
    ));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        Some("2026-02-01T00:00:00Z"),
        Some("id-newer"),
        false,
    )];

    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert!(matches!(
        result.result,
        ConflictResult::ConflictGroup { .. }
    ));
}

#[test]
fn same_valid_from_creates_conflict_group() {
    let proposal = proposal_for(proposed_claim(
        "user:42",
        Some("city"),
        Some("2026-02-01T00:00:00Z"),
        Some("p1"),
    ));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        Some("2026-02-01T00:00:00Z"),
        Some("id-same"),
        false,
    )];

    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert!(matches!(
        result.result,
        ConflictResult::ConflictGroup { .. }
    ));
}

#[test]
fn proposed_without_valid_from_and_existing_with_valid_from_creates_conflict_group() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        Some("2026-02-01T00:00:00Z"),
        Some("id-1"),
        false,
    )];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert!(matches!(
        result.result,
        ConflictResult::ConflictGroup { .. }
    ));
}

#[test]
fn multiple_matching_claims_without_temporal_order_return_all_ids() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing = vec![
        existing_claim("user:42", Some("city"), None, Some("id-1"), false),
        existing_claim("user:42", Some("city"), None, Some("id-2"), false),
        existing_claim("user:42", Some("city"), None, Some("id-3"), false),
    ];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(
        result.result,
        ConflictResult::ConflictGroup {
            claim_ids: vec!["id-1".to_owned(), "id-2".to_owned(), "id-3".to_owned()]
        }
    );
    assert_eq!(result.matched_claim_id, None);
}

#[test]
fn conflict_group_contains_only_matching_subject_and_attribute_ids() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing = vec![
        existing_claim("user:42", Some("city"), None, Some("id-match-1"), false),
        existing_claim(
            "user:42",
            Some("country"),
            None,
            Some("id-other-attr"),
            false,
        ),
        existing_claim("user:99", Some("city"), None, Some("id-other-subj"), false),
        existing_claim("user:42", Some("city"), None, Some("id-match-2"), false),
    ];

    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(
        result.result,
        ConflictResult::ConflictGroup {
            claim_ids: vec!["id-match-1".to_owned(), "id-match-2".to_owned()]
        }
    );
}

#[test]
fn temporal_succession_returns_identifier_from_existing_claim_source_ref() {
    let proposal = proposal_for(proposed_claim(
        "user:42",
        Some("city"),
        Some("2026-05-01T00:00:00Z"),
        Some("p1"),
    ));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        Some("2026-01-01T00:00:00Z"),
        Some("db-claim-id"),
        false,
    )];

    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.matched_claim_id, Some("db-claim-id".to_owned()));
}

#[test]
fn temporal_succession_without_existing_source_ref_sets_no_matched_id() {
    let proposal = proposal_for(proposed_claim(
        "user:42",
        Some("city"),
        Some("2026-05-01T00:00:00Z"),
        Some("p1"),
    ));
    let existing = vec![existing_claim(
        "user:42",
        Some("city"),
        Some("2026-01-01T00:00:00Z"),
        None,
        false,
    )];

    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.result, ConflictResult::TemporalSuccession);
    assert_eq!(result.matched_claim_id, None);
}

#[test]
fn matching_claim_among_non_matching_entries_still_detects_temporal_succession() {
    let proposal = proposal_for(proposed_claim(
        "user:42",
        Some("city"),
        Some("2026-03-01T00:00:00Z"),
        Some("p1"),
    ));
    let existing = vec![
        existing_claim("user:99", Some("city"), None, Some("id-a"), false),
        existing_claim(
            "user:42",
            Some("city"),
            Some("2026-01-01T00:00:00Z"),
            Some("id-b"),
            false,
        ),
        existing_claim("user:42", Some("country"), None, Some("id-c"), false),
    ];

    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.result, ConflictResult::TemporalSuccession);
    assert_eq!(result.matched_claim_id, Some("id-b".to_owned()));
}

#[test]
fn none_attribute_with_newer_timestamp_is_temporal_succession() {
    let proposal = proposal_for(proposed_claim(
        "user:42",
        None,
        Some("2026-03-01T00:00:00Z"),
        Some("p1"),
    ));
    let existing = vec![existing_claim(
        "user:42",
        None,
        Some("2026-01-01T00:00:00Z"),
        Some("id-subjective"),
        false,
    )];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.result, ConflictResult::TemporalSuccession);
}

#[test]
fn none_attribute_without_clear_temporal_order_is_conflict_group() {
    let proposal = proposal_for(proposed_claim("user:42", None, None, Some("p1")));
    let existing = vec![existing_claim(
        "user:42",
        None,
        None,
        Some("id-subjective"),
        false,
    )];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert!(matches!(
        result.result,
        ConflictResult::ConflictGroup { .. }
    ));
}

#[test]
fn empty_existing_slice_returns_no_conflict() {
    let proposal = proposal_for(proposed_claim("user:42", Some("city"), None, Some("p1")));
    let existing: Vec<ClaimData> = Vec::new();
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert_eq!(result.result, ConflictResult::NoConflict);
}

#[test]
fn empty_string_attribute_matches_same_empty_string_attribute() {
    let proposal = proposal_for(proposed_claim("user:42", Some(""), None, Some("p1")));
    let existing = vec![existing_claim(
        "user:42",
        Some(""),
        None,
        Some("id-empty"),
        false,
    )];
    let result = detect_conflicts(&proposal, &existing).expect("detect_conflicts should succeed");
    assert!(matches!(
        result.result,
        ConflictResult::ConflictGroup { .. }
    ));
}
