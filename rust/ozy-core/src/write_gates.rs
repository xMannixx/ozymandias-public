use ozy_contracts::{
    ClaimData, G1Result, G2Result, G3Result, HandlingPolicy, OzyError, ProposalData, Sensitivity,
    SourceType, WriteGateInput,
};

pub fn validate_schema(input: &WriteGateInput) -> Result<G1Result, OzyError> {
    let claim = &input.proposal.proposed_claim;
    let mut errors = Vec::new();

    if is_blank(&claim.subject) {
        errors.push("subject must not be empty".to_owned());
    }

    if is_blank(&claim.value) {
        errors.push("value must not be empty".to_owned());
    }

    if is_blank(&claim.content) {
        errors.push("content must not be empty".to_owned());
    }

    if !is_valid_confidence(claim.confidence) {
        errors.push("confidence must be within 0.0..=1.0 and finite".to_owned());
    }

    if claim.sensitivity == Sensitivity::S4 && claim.handling_policy != HandlingPolicy::S4Isolated {
        errors.push("S4 claims must use handling policy S4Isolated".to_owned());
    }

    if claim.sensitivity == Sensitivity::S3
        && claim.handling_policy == HandlingPolicy::CloudOkEncrypted
    {
        errors.push("S3 claims must not use handling policy CloudOkEncrypted".to_owned());
    }

    if errors.is_empty() {
        Ok(G1Result::SchemaValid)
    } else {
        Ok(G1Result::SchemaError { errors })
    }
}

pub fn check_provenance(proposal: &ProposalData) -> Result<G2Result, OzyError> {
    let result = match proposal.source_type {
        SourceType::UserExplicit | SourceType::UserConfirmed => G2Result {
            auto_confirm_eligible: true,
            locked_to_tentative: false,
        },
        SourceType::ModelInferred | SourceType::ConnectorData => G2Result {
            auto_confirm_eligible: false,
            locked_to_tentative: true,
        },
    };

    Ok(result)
}

pub fn detect_conflicts(
    proposal: &ProposalData,
    existing_claims: &[ClaimData],
) -> Result<G3Result, OzyError> {
    let proposed_claim = &proposal.proposed_claim;
    let matches: Vec<&ClaimData> = existing_claims
        .iter()
        .filter(|existing| claims_match(proposed_claim, existing))
        .collect();

    if matches.is_empty() {
        return Ok(G3Result {
            result: ozy_contracts::ConflictResult::NoConflict,
            matched_claim_id: None,
        });
    }

    if matches.iter().any(|claim| claim.user_locked) {
        return Err(OzyError::InvariantViolation {
            message: "locked claim cannot be overridden".to_owned(),
        });
    }

    if let Some(matched) = matches.iter().find(|claim| {
        is_temporal_successor(
            proposed_claim.valid_from.as_deref(),
            claim.valid_from.as_deref(),
        )
    }) {
        return Ok(G3Result {
            result: ozy_contracts::ConflictResult::TemporalSuccession,
            matched_claim_id: matched.source_ref.clone(),
        });
    }

    let claim_ids = matches
        .iter()
        .filter_map(|claim| claim.source_ref.clone())
        .collect();

    Ok(G3Result {
        result: ozy_contracts::ConflictResult::ConflictGroup { claim_ids },
        matched_claim_id: None,
    })
}

fn is_blank(value: &str) -> bool {
    value.trim().is_empty()
}

fn is_valid_confidence(confidence: f64) -> bool {
    confidence.is_finite() && (0.0..=1.0).contains(&confidence)
}

fn claims_match(proposed: &ClaimData, existing: &ClaimData) -> bool {
    proposed.subject == existing.subject && proposed.attribute == existing.attribute
}

fn is_temporal_successor(
    proposed_valid_from: Option<&str>,
    existing_valid_from: Option<&str>,
) -> bool {
    match (proposed_valid_from, existing_valid_from) {
        (Some(proposed), Some(existing)) => proposed > existing,
        (Some(_), None) => true,
        (None, _) => false,
    }
}
