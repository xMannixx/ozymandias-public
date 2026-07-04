//! Struct payloads from the Ozy contracts specification.

use crate::enums::{
    ApprovalClass, AuditEventType, AuditResult, AuthorityLevel, Channel, ConflictGroupStatus,
    ConflictResult, DecayActionType, FilterReason, HandlingPolicy, Lifecycle, MemoryType,
    Sensitivity, SourceType, TrustLevel, VerificationState,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClaimData {
    pub subject: String,
    pub attribute: Option<String>,
    pub value: String,
    pub content: String,
    pub memory_type: MemoryType,
    pub sensitivity: Sensitivity,
    pub trust_level: TrustLevel,
    pub handling_policy: HandlingPolicy,
    pub verification_state: VerificationState,
    pub confidence: f64,
    pub source_type: SourceType,
    pub source_ref: Option<String>,
    pub user_locked: bool,
    pub decay_eligible: bool,
    pub lifecycle: Lifecycle,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProposalData {
    pub proposed_claim: ClaimData,
    pub source_ref: Option<String>,
    pub source_type: SourceType,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConflictGroupData {
    pub group_id: String,
    pub claim_ids: Vec<String>,
    pub status: ConflictGroupStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WriteGateInput {
    pub proposal: ProposalData,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct G2Result {
    pub auto_confirm_eligible: bool,
    pub locked_to_tentative: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct G3Result {
    pub result: ConflictResult,
    pub matched_claim_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SensitivityFilterInput {
    pub claims: Vec<ClaimData>,
    pub intent_type: String,
    pub provider_is_local: bool,
    pub provider_is_encrypted: bool,
    /// Explicit per-turn opt-in to allow S3 claims to reach an encrypted cloud
    /// provider. Defaults to false (fail-closed) if absent from the payload.
    /// Has no effect on S4, which is always hard-local regardless of this flag.
    #[serde(default)]
    pub allow_s3_cloud_fallback: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SensitivityFilterOutput {
    pub allowed: Vec<ClaimData>,
    pub filtered_count: u32,
    pub filter_reasons: Vec<FilterReason>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PayloadSensitivityInput {
    pub action_class: ApprovalClass,
    pub payload_sensitivity: Sensitivity,
    pub target_channel: Channel,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub action_type: String,
    pub approval_class: ApprovalClass,
    pub payload_preview: Option<String>,
    pub authority_level: AuthorityLevel,
    pub payload_sensitivity: Option<Sensitivity>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaintChunk {
    pub chunk_id: String,
    pub trust_level: TrustLevel,
    pub sensitivity: Sensitivity,
    pub source_type: SourceType,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaintContext {
    pub chunks: Vec<TaintChunk>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaintSummary {
    pub effective_trust: TrustLevel,
    pub effective_sensitivity: Sensitivity,
    pub is_tainted: bool,
    pub taint_sources: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaintActionCheck {
    pub taint_summary: TaintSummary,
    pub proposed_class: ApprovalClass,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AuditEntry {
    pub event_type: AuditEventType,
    pub result: AuditResult,
    pub actor: String,
    pub target_id: String,
    pub detail: String,
    pub timestamp: String,
    pub sensitivity: Sensitivity,
    pub channel: Channel,
    pub payload: Option<String>,
    pub source_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CircuitBreakerConfig {
    pub max_actions_per_window: u32,
    pub window_seconds: u64,
    pub cooldown_seconds: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TokenBudgetRequest {
    pub intent_type: String,
    pub available_tokens: u32,
    pub claims_count: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TokenBudgetAllocation {
    pub max_claims: u32,
    pub max_tokens_per_claim: u32,
    pub truncation_needed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecayAction {
    pub claim_ref: String,
    pub action: DecayActionType,
}

#[cfg(test)]
mod tests {
    use super::{
        ApprovalRequest, AuditEntry, Channel, CircuitBreakerConfig, ClaimData, ConflictGroupData,
        DecayAction, G2Result, G3Result, PayloadSensitivityInput, ProposalData,
        SensitivityFilterInput, SensitivityFilterOutput, TaintActionCheck, TaintChunk,
        TaintContext, TaintSummary, TokenBudgetAllocation, TokenBudgetRequest, WriteGateInput,
    };
    use crate::enums::{
        ApprovalClass, AuditEventType, AuditResult, AuthorityLevel, ConflictGroupStatus,
        ConflictResult, DecayActionType, FilterReason, HandlingPolicy, Lifecycle, MemoryType,
        Sensitivity, SourceType, TrustLevel, VerificationState,
    };
    use serde::{Deserialize, Serialize};
    use serde_json::{from_str, to_string};

    fn roundtrip_json<T>(value: &T) -> T
    where
        T: Serialize + for<'de> Deserialize<'de> + PartialEq + std::fmt::Debug,
    {
        let json = to_string(value).expect("serialize to JSON");
        from_str(&json).expect("deserialize from JSON")
    }

    fn sample_claim() -> ClaimData {
        ClaimData {
            subject: "user:42".to_owned(),
            attribute: Some("role".to_owned()),
            value: "maintainer".to_owned(),
            content: "User is maintainer".to_owned(),
            memory_type: MemoryType::Profile,
            sensitivity: Sensitivity::S1,
            trust_level: TrustLevel::T2,
            handling_policy: HandlingPolicy::LocalPreferred,
            verification_state: VerificationState::Tentative,
            confidence: 0.82,
            source_type: SourceType::UserExplicit,
            source_ref: Some("turn:123".to_owned()),
            user_locked: false,
            decay_eligible: true,
            lifecycle: Lifecycle::Permanent,
            valid_from: None,
            valid_to: None,
        }
    }

    #[test]
    fn memory_pipeline_structs_roundtrip() {
        let claim = sample_claim();
        assert_eq!(roundtrip_json(&claim), claim);

        let proposal = ProposalData {
            proposed_claim: sample_claim(),
            source_ref: Some("api".to_owned()),
            source_type: SourceType::ConnectorData,
        };
        assert_eq!(roundtrip_json(&proposal), proposal);

        let conflict_group = ConflictGroupData {
            group_id: "grp-1".to_owned(),
            claim_ids: vec!["c-1".to_owned(), "c-2".to_owned()],
            status: ConflictGroupStatus::Pending,
        };
        assert_eq!(roundtrip_json(&conflict_group), conflict_group);
    }

    #[test]
    fn write_gate_structs_roundtrip() {
        let input = WriteGateInput {
            proposal: ProposalData {
                proposed_claim: sample_claim(),
                source_ref: None,
                source_type: SourceType::ModelInferred,
            },
        };
        assert_eq!(roundtrip_json(&input), input);

        let g2 = G2Result {
            auto_confirm_eligible: true,
            locked_to_tentative: false,
        };
        assert_eq!(roundtrip_json(&g2), g2);

        let g3 = G3Result {
            result: ConflictResult::TemporalSuccession,
            matched_claim_id: Some("c-old".to_owned()),
        };
        assert_eq!(roundtrip_json(&g3), g3);
    }

    #[test]
    fn sensitivity_router_structs_roundtrip() {
        let input = SensitivityFilterInput {
            claims: vec![sample_claim()],
            intent_type: "summarize".to_owned(),
            provider_is_local: true,
            provider_is_encrypted: true,
            allow_s3_cloud_fallback: true,
        };
        assert_eq!(roundtrip_json(&input), input);

        let output = SensitivityFilterOutput {
            allowed: vec![],
            filtered_count: 1,
            filter_reasons: vec![FilterReason::ProviderNotEncrypted],
        };
        assert_eq!(roundtrip_json(&output), output);
    }

    #[test]
    fn sensitivity_filter_input_allow_s3_cloud_fallback_defaults_to_false() {
        let json_without_field = r#"{
            "claims": [],
            "intent_type": "summarize",
            "provider_is_local": false,
            "provider_is_encrypted": true
        }"#;
        let parsed: SensitivityFilterInput = from_str(json_without_field)
            .expect("payload without allow_s3_cloud_fallback must still deserialize");
        assert!(!parsed.allow_s3_cloud_fallback);
    }

    #[test]
    fn approval_and_audit_structs_roundtrip() {
        let payload_input = PayloadSensitivityInput {
            action_class: ApprovalClass::Class2,
            payload_sensitivity: Sensitivity::S2,
            target_channel: Channel::Web,
        };
        assert_eq!(roundtrip_json(&payload_input), payload_input);

        let approval_request = ApprovalRequest {
            action_type: "send_message".to_owned(),
            approval_class: ApprovalClass::Class2,
            payload_preview: Some("hello".to_owned()),
            authority_level: AuthorityLevel::A1,
            payload_sensitivity: Some(Sensitivity::S2),
        };
        assert_eq!(roundtrip_json(&approval_request), approval_request);

        let audit_entry = AuditEntry {
            event_type: AuditEventType::ActionExecuted,
            result: AuditResult::Success,
            actor: "system:validator".to_owned(),
            target_id: "claim:123".to_owned(),
            detail: "validated and stored claim update".to_owned(),
            timestamp: "2026-04-04T12:34:56Z".to_owned(),
            sensitivity: Sensitivity::S0,
            channel: Channel::System,
            payload: Some("{\"k\":\"v\"}".to_owned()),
            source_ref: Some("source-1".to_owned()),
        };
        assert_eq!(roundtrip_json(&audit_entry), audit_entry);
    }

    #[test]
    fn taint_tracker_structs_roundtrip() {
        let chunk = TaintChunk {
            chunk_id: "chunk-1".to_owned(),
            trust_level: TrustLevel::T1,
            sensitivity: Sensitivity::S3,
            source_type: SourceType::ModelInferred,
        };
        assert_eq!(roundtrip_json(&chunk), chunk);

        let context = TaintContext {
            chunks: vec![
                chunk.clone(),
                TaintChunk {
                    chunk_id: "chunk-2".to_owned(),
                    trust_level: TrustLevel::T3,
                    sensitivity: Sensitivity::S1,
                    source_type: SourceType::UserExplicit,
                },
            ],
        };
        assert_eq!(roundtrip_json(&context), context);

        let summary = TaintSummary {
            effective_trust: TrustLevel::T1,
            effective_sensitivity: Sensitivity::S3,
            is_tainted: true,
            taint_sources: vec!["chunk-1".to_owned()],
        };
        assert_eq!(roundtrip_json(&summary), summary);

        let check = TaintActionCheck {
            taint_summary: summary,
            proposed_class: ApprovalClass::Class2,
        };
        assert_eq!(roundtrip_json(&check), check);
    }

    #[test]
    fn infrastructure_structs_roundtrip() {
        let breaker = CircuitBreakerConfig {
            max_actions_per_window: 15,
            window_seconds: 60,
            cooldown_seconds: 180,
        };
        assert_eq!(roundtrip_json(&breaker), breaker);

        let request = TokenBudgetRequest {
            intent_type: "analyze".to_owned(),
            available_tokens: 8_000,
            claims_count: 6,
        };
        assert_eq!(roundtrip_json(&request), request);

        let allocation = TokenBudgetAllocation {
            max_claims: 4,
            max_tokens_per_claim: 500,
            truncation_needed: true,
        };
        assert_eq!(roundtrip_json(&allocation), allocation);

        let decay_action = DecayAction {
            claim_ref: "claim-77".to_owned(),
            action: DecayActionType::Expire,
        };
        assert_eq!(roundtrip_json(&decay_action), decay_action);
    }
}
