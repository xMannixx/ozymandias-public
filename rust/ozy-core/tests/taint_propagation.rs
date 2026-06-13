use ozy_contracts::{
    OzyError, Sensitivity, SourceType, TaintChunk, TaintContext, TaintSummary, TrustLevel,
};
use ozy_core::compute_taint;

fn chunk(chunk_id: &str, trust_level: TrustLevel, sensitivity: Sensitivity) -> TaintChunk {
    TaintChunk {
        chunk_id: chunk_id.to_owned(),
        trust_level,
        sensitivity,
        source_type: SourceType::ModelInferred,
    }
}

fn context(chunks: Vec<TaintChunk>) -> TaintContext {
    TaintContext { chunks }
}

fn summary(context: TaintContext) -> TaintSummary {
    compute_taint(&context).expect("compute_taint should return Ok")
}

#[test]
fn single_t3_s0_chunk_is_not_tainted() {
    let result = summary(context(vec![chunk("c1", TrustLevel::T3, Sensitivity::S0)]));
    assert_eq!(result.effective_trust, TrustLevel::T3);
    assert_eq!(result.effective_sensitivity, Sensitivity::S0);
    assert!(!result.is_tainted);
}

#[test]
fn single_t0_s0_chunk_is_tainted() {
    let result = summary(context(vec![chunk("c1", TrustLevel::T0, Sensitivity::S0)]));
    assert_eq!(result.effective_trust, TrustLevel::T0);
    assert!(result.is_tainted);
}

#[test]
fn single_t3_s4_chunk_is_tainted() {
    let result = summary(context(vec![chunk("c1", TrustLevel::T3, Sensitivity::S4)]));
    assert_eq!(result.effective_sensitivity, Sensitivity::S4);
    assert!(result.is_tainted);
}

#[test]
fn trust_minimum_of_t3_and_t1_is_t1_and_tainted() {
    let result = summary(context(vec![
        chunk("c1", TrustLevel::T3, Sensitivity::S0),
        chunk("c2", TrustLevel::T1, Sensitivity::S0),
    ]));
    assert_eq!(result.effective_trust, TrustLevel::T1);
    assert!(result.is_tainted);
}

#[test]
fn trust_minimum_of_t2_and_t3_is_t2_and_not_tainted() {
    let result = summary(context(vec![
        chunk("c1", TrustLevel::T2, Sensitivity::S0),
        chunk("c2", TrustLevel::T3, Sensitivity::S1),
    ]));
    assert_eq!(result.effective_trust, TrustLevel::T2);
    assert!(!result.is_tainted);
}

#[test]
fn mixed_trust_chunks_pick_lowest_trust() {
    let result = summary(context(vec![
        chunk("c1", TrustLevel::T3, Sensitivity::S0),
        chunk("c2", TrustLevel::T2, Sensitivity::S1),
        chunk("c3", TrustLevel::T0, Sensitivity::S2),
    ]));
    assert_eq!(result.effective_trust, TrustLevel::T0);
}

#[test]
fn sensitivity_maximum_of_s0_and_s3_is_s3_and_tainted() {
    let result = summary(context(vec![
        chunk("c1", TrustLevel::T3, Sensitivity::S0),
        chunk("c2", TrustLevel::T3, Sensitivity::S3),
    ]));
    assert_eq!(result.effective_sensitivity, Sensitivity::S3);
    assert!(result.is_tainted);
}

#[test]
fn sensitivity_maximum_of_s1_and_s2_is_s2_and_not_tainted() {
    let result = summary(context(vec![
        chunk("c1", TrustLevel::T3, Sensitivity::S1),
        chunk("c2", TrustLevel::T3, Sensitivity::S2),
    ]));
    assert_eq!(result.effective_sensitivity, Sensitivity::S2);
    assert!(!result.is_tainted);
}

#[test]
fn t0_chunk_is_in_taint_sources() {
    let result = summary(context(vec![
        chunk("low-trust", TrustLevel::T0, Sensitivity::S0),
        chunk("safe", TrustLevel::T3, Sensitivity::S0),
    ]));
    assert!(result.taint_sources.contains(&"low-trust".to_owned()));
}

#[test]
fn s3_chunk_is_in_taint_sources() {
    let result = summary(context(vec![
        chunk("sensitive", TrustLevel::T3, Sensitivity::S3),
        chunk("safe", TrustLevel::T3, Sensitivity::S0),
    ]));
    assert!(result.taint_sources.contains(&"sensitive".to_owned()));
}

#[test]
fn non_tainting_chunk_is_not_in_taint_sources() {
    let result = summary(context(vec![
        chunk("neutral", TrustLevel::T2, Sensitivity::S1),
        chunk("tainted", TrustLevel::T0, Sensitivity::S0),
    ]));
    assert!(!result.taint_sources.contains(&"neutral".to_owned()));
}

#[test]
fn multiple_taint_sources_are_collected() {
    let result = summary(context(vec![
        chunk("trust-taint", TrustLevel::T1, Sensitivity::S1),
        chunk("sens-taint", TrustLevel::T3, Sensitivity::S4),
        chunk("safe", TrustLevel::T3, Sensitivity::S0),
    ]));
    assert!(result.taint_sources.contains(&"trust-taint".to_owned()));
    assert!(result.taint_sources.contains(&"sens-taint".to_owned()));
}

#[test]
fn t2_s2_boundary_is_not_tainted() {
    let result = summary(context(vec![chunk("c1", TrustLevel::T2, Sensitivity::S2)]));
    assert!(!result.is_tainted);
}

#[test]
fn t1_s2_boundary_is_tainted() {
    let result = summary(context(vec![chunk("c1", TrustLevel::T1, Sensitivity::S2)]));
    assert!(result.is_tainted);
}

#[test]
fn t2_s3_boundary_is_tainted() {
    let result = summary(context(vec![chunk("c1", TrustLevel::T2, Sensitivity::S3)]));
    assert!(result.is_tainted);
}

#[test]
fn empty_chunks_returns_invariant_violation() {
    let result = compute_taint(&context(vec![]));
    assert!(matches!(result, Err(OzyError::InvariantViolation { .. })));
}

#[test]
fn all_t0_chunks_yield_t0_and_all_sources() {
    let result = summary(context(vec![
        chunk("c1", TrustLevel::T0, Sensitivity::S0),
        chunk("c2", TrustLevel::T0, Sensitivity::S1),
    ]));
    assert_eq!(result.effective_trust, TrustLevel::T0);
    assert_eq!(result.taint_sources.len(), 2);
}

#[test]
fn all_s4_chunks_yield_s4_and_all_sources() {
    let result = summary(context(vec![
        chunk("c1", TrustLevel::T3, Sensitivity::S4),
        chunk("c2", TrustLevel::T2, Sensitivity::S4),
    ]));
    assert_eq!(result.effective_sensitivity, Sensitivity::S4);
    assert_eq!(result.taint_sources.len(), 2);
}
