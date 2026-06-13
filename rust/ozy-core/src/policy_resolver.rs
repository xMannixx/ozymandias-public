use ozy_contracts::{
    ApprovalClass, ApprovalDecision, ApprovalRequest, AuthorityLevel, OzyError, Sensitivity,
};

pub fn resolve_approval(request: &ApprovalRequest) -> Result<ApprovalDecision, OzyError> {
    if let Some(new_class) = escalated_class(request.approval_class, request.payload_sensitivity) {
        return Ok(ApprovalDecision::EscalatedTo { new_class });
    }

    let decision = match request.approval_class {
        ApprovalClass::Class0 => ApprovalDecision::Approved,
        ApprovalClass::Class1 | ApprovalClass::Class2 => {
            if authority_rank(request.authority_level) >= authority_rank(AuthorityLevel::A1) {
                ApprovalDecision::Approved
            } else {
                ApprovalDecision::Denied {
                    reason: "authority level A1 or higher required".to_owned(),
                }
            }
        }
        ApprovalClass::Class3 => {
            if authority_rank(request.authority_level) < authority_rank(AuthorityLevel::A1) {
                ApprovalDecision::Denied {
                    reason: "authority level A1 or higher required".to_owned(),
                }
            } else if request.payload_preview.is_none() {
                ApprovalDecision::Denied {
                    reason: "payload_preview is required for Class3 actions".to_owned(),
                }
            } else {
                ApprovalDecision::Approved
            }
        }
        ApprovalClass::Class4 => {
            if request.authority_level == AuthorityLevel::A2 {
                ApprovalDecision::Approved
            } else {
                ApprovalDecision::Denied {
                    reason: "authority level A2 required for Class4 actions".to_owned(),
                }
            }
        }
    };

    Ok(decision)
}

fn escalated_class(
    current: ApprovalClass,
    sensitivity: Option<Sensitivity>,
) -> Option<ApprovalClass> {
    let required = match sensitivity {
        Some(Sensitivity::S3) => Some(ApprovalClass::Class3),
        Some(Sensitivity::S4) => Some(ApprovalClass::Class4),
        _ => None,
    }?;

    if class_rank(required) > class_rank(current) {
        Some(required)
    } else {
        None
    }
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

fn authority_rank(level: AuthorityLevel) -> u8 {
    match level {
        AuthorityLevel::A0 => 0,
        AuthorityLevel::A1 => 1,
        AuthorityLevel::A2 => 2,
    }
}
