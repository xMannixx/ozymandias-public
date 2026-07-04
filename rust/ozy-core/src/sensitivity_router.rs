use ozy_contracts::{
    ApprovalClass, Channel, FilterReason, OzyError, PayloadSensitivityInput,
    PayloadSensitivityResult, Sensitivity, SensitivityFilterInput, SensitivityFilterOutput,
};

pub fn filter_claims(input: &SensitivityFilterInput) -> Result<SensitivityFilterOutput, OzyError> {
    let mut allowed = Vec::with_capacity(input.claims.len());
    let mut filter_reasons = Vec::new();

    for claim in &input.claims {
        let reason = match claim.sensitivity {
            Sensitivity::S0 | Sensitivity::S1 => None,
            Sensitivity::S2 => {
                if input.provider_is_encrypted {
                    None
                } else {
                    Some(FilterReason::ProviderNotEncrypted)
                }
            }
            Sensitivity::S3 => {
                // S3 is default-local. A non-local (cloud) provider may only
                // receive S3 claims if the caller explicitly opted in via
                // allow_s3_cloud_fallback for this turn AND the provider is
                // encrypted. Encryption alone is not sufficient consent.
                if input.provider_is_local
                    || (input.allow_s3_cloud_fallback && input.provider_is_encrypted)
                {
                    None
                } else {
                    Some(FilterReason::SensitivityTooHigh {
                        claim_sensitivity: Sensitivity::S3,
                        max_allowed: Sensitivity::S2,
                    })
                }
            }
            Sensitivity::S4 => {
                if !input.provider_is_local {
                    Some(FilterReason::ProviderNotLocal)
                } else if input.intent_type != "intimate_reflection" {
                    Some(FilterReason::IntentMismatch {
                        claim_sensitivity: Sensitivity::S4,
                        intent_type: input.intent_type.clone(),
                    })
                } else {
                    None
                }
            }
        };

        if let Some(filter_reason) = reason {
            filter_reasons.push(filter_reason);
        } else {
            allowed.push(claim.clone());
        }
    }

    Ok(SensitivityFilterOutput {
        filtered_count: filter_reasons.len() as u32,
        allowed,
        filter_reasons,
    })
}

pub fn check_payload_sensitivity(
    input: &PayloadSensitivityInput,
) -> Result<PayloadSensitivityResult, OzyError> {
    let non_local_channel = is_non_local_channel(input.target_channel);

    let result = match input.payload_sensitivity {
        Sensitivity::S0 | Sensitivity::S1 | Sensitivity::S2 => PayloadSensitivityResult::Allowed,
        Sensitivity::S3 => {
            if non_local_channel {
                PayloadSensitivityResult::Escalated {
                    new_class: elevate_at_least(input.action_class, ApprovalClass::Class3),
                }
            } else {
                PayloadSensitivityResult::Allowed
            }
        }
        Sensitivity::S4 => {
            if is_remote_write_class(input.action_class) {
                PayloadSensitivityResult::Warning {
                    message: "S4 payload detected for remote write class (Class3+). Review before execution.".to_owned(),
                }
            } else if non_local_channel {
                PayloadSensitivityResult::Escalated {
                    new_class: elevate_at_least(input.action_class, ApprovalClass::Class4),
                }
            } else {
                PayloadSensitivityResult::Allowed
            }
        }
    };

    Ok(result)
}

fn is_remote_write_class(class: ApprovalClass) -> bool {
    matches!(class, ApprovalClass::Class3 | ApprovalClass::Class4)
}

fn is_non_local_channel(channel: Channel) -> bool {
    matches!(channel, Channel::Web | Channel::Telegram)
}

fn elevate_at_least(current: ApprovalClass, min: ApprovalClass) -> ApprovalClass {
    if class_rank(current) >= class_rank(min) {
        current
    } else {
        min
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
