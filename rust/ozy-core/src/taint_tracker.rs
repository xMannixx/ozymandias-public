use ozy_contracts::{
    ApprovalClass, OzyError, Sensitivity, TaintActionCheck, TaintContext, TaintDecision,
    TaintSummary, TrustLevel,
};

pub fn compute_taint(context: &TaintContext) -> Result<TaintSummary, OzyError> {
    if context.chunks.is_empty() {
        return Err(OzyError::InvariantViolation {
            message: "taint context must include at least one chunk".to_owned(),
        });
    }

    let mut effective_trust = context.chunks[0].trust_level;
    let mut effective_sensitivity = context.chunks[0].sensitivity;
    let mut taint_sources = Vec::new();

    for chunk in &context.chunks {
        if trust_rank(chunk.trust_level) < trust_rank(effective_trust) {
            effective_trust = chunk.trust_level;
        }

        if sensitivity_rank(chunk.sensitivity) > sensitivity_rank(effective_sensitivity) {
            effective_sensitivity = chunk.sensitivity;
        }

        if is_taint_source(chunk.trust_level, chunk.sensitivity) {
            taint_sources.push(chunk.chunk_id.clone());
        }
    }

    let is_tainted = trust_rank(effective_trust) <= trust_rank(TrustLevel::T1)
        || sensitivity_rank(effective_sensitivity) >= sensitivity_rank(Sensitivity::S3);

    Ok(TaintSummary {
        effective_trust,
        effective_sensitivity,
        is_tainted,
        taint_sources,
    })
}

pub fn check_tainted_action(check: &TaintActionCheck) -> Result<TaintDecision, OzyError> {
    let summary = &check.taint_summary;

    if !summary.is_tainted {
        return Ok(TaintDecision::Proceed);
    }

    if summary.effective_trust == TrustLevel::T0
        && class_rank(check.proposed_class) >= class_rank(ApprovalClass::Class2)
    {
        return Ok(TaintDecision::Block {
            reason: "T0 untrusted taint blocks mutation actions (Class2+)".to_owned(),
        });
    }

    let mut required_class = None;

    if sensitivity_rank(summary.effective_sensitivity) >= sensitivity_rank(Sensitivity::S4) {
        required_class = Some(ApprovalClass::Class4);
    } else if sensitivity_rank(summary.effective_sensitivity) >= sensitivity_rank(Sensitivity::S3) {
        required_class = Some(ApprovalClass::Class3);
    }

    if summary.effective_trust == TrustLevel::T1 {
        required_class = Some(match required_class {
            Some(current) => elevate_at_least(current, ApprovalClass::Class2),
            None => ApprovalClass::Class2,
        });
    }

    let decision = match required_class {
        Some(required) if class_rank(check.proposed_class) < class_rank(required) => {
            TaintDecision::Escalate {
                new_class: required,
                reason: "taint escalation required".to_owned(),
            }
        }
        _ => TaintDecision::Proceed,
    };

    Ok(decision)
}

fn trust_rank(level: TrustLevel) -> u8 {
    match level {
        TrustLevel::T0 => 0,
        TrustLevel::T1 => 1,
        TrustLevel::T2 => 2,
        TrustLevel::T3 => 3,
    }
}

fn sensitivity_rank(level: Sensitivity) -> u8 {
    match level {
        Sensitivity::S0 => 0,
        Sensitivity::S1 => 1,
        Sensitivity::S2 => 2,
        Sensitivity::S3 => 3,
        Sensitivity::S4 => 4,
    }
}

fn is_taint_source(trust_level: TrustLevel, sensitivity: Sensitivity) -> bool {
    trust_rank(trust_level) <= trust_rank(TrustLevel::T1)
        || sensitivity_rank(sensitivity) >= sensitivity_rank(Sensitivity::S3)
}

fn class_rank(class: ApprovalClass) -> u8 {
    match class {
        ApprovalClass::Class0 => 0,
        ApprovalClass::Class1 => 1,
        ApprovalClass::Class2 => 2,
        ApprovalClass::Class3 => 3,
        ApprovalClass::Class4 => 4,
    }
}

fn elevate_at_least(current: ApprovalClass, min: ApprovalClass) -> ApprovalClass {
    if class_rank(current) >= class_rank(min) {
        current
    } else {
        min
    }
}
