use ozy_contracts::{OzyError, TokenBudgetAllocation, TokenBudgetRequest};
use ozy_core::allocate_token_budget;

fn req(intent_type: &str, available_tokens: u32, claims_count: u32) -> TokenBudgetRequest {
    TokenBudgetRequest {
        intent_type: intent_type.to_owned(),
        available_tokens,
        claims_count,
    }
}

fn assert_alloc(
    result: Result<TokenBudgetAllocation, OzyError>,
    max_claims: u32,
    max_tokens_per_claim: u32,
    truncation_needed: bool,
) {
    let allocation = result.expect("result should be Ok");
    assert_eq!(allocation.max_claims, max_claims);
    assert_eq!(allocation.max_tokens_per_claim, max_tokens_per_claim);
    assert_eq!(allocation.truncation_needed, truncation_needed);
}

#[test]
fn available_tokens_zero_returns_invariant_violation() {
    let result = allocate_token_budget(&req("analyze", 0, 5));
    assert!(matches!(result, Err(OzyError::InvariantViolation { .. })));
}

#[test]
fn claims_count_zero_returns_empty_allocation() {
    assert_alloc(
        allocate_token_budget(&req("analyze", 1_000, 0)),
        0,
        0,
        false,
    );
}

#[test]
fn base_division_1000_by_10_is_100_without_truncation() {
    assert_alloc(
        allocate_token_budget(&req("analyze", 1_000, 10)),
        10,
        100,
        false,
    );
}

#[test]
fn base_division_1000_by_5_is_200_without_truncation() {
    assert_alloc(
        allocate_token_budget(&req("analyze", 1_000, 5)),
        5,
        200,
        false,
    );
}

#[test]
fn base_division_100_by_3_triggers_truncation_and_reduction() {
    assert_alloc(allocate_token_budget(&req("analyze", 100, 3)), 2, 50, true);
}

#[test]
fn base_division_50_by_1_is_50_without_truncation() {
    assert_alloc(allocate_token_budget(&req("analyze", 50, 1)), 1, 50, false);
}

#[test]
fn truncation_reduction_200_by_5_reduces_to_4_claims() {
    assert_alloc(allocate_token_budget(&req("analyze", 200, 5)), 4, 50, true);
}

#[test]
fn truncation_reduction_49_by_10_results_in_zero_claims() {
    assert_alloc(allocate_token_budget(&req("analyze", 49, 10)), 0, 0, true);
}

#[test]
fn truncation_reduction_50_by_2_reduces_to_one_claim() {
    assert_alloc(allocate_token_budget(&req("analyze", 50, 2)), 1, 50, true);
}

#[test]
fn intimate_reflection_doubles_tokens_per_claim() {
    assert_alloc(
        allocate_token_budget(&req("intimate_reflection", 1_000, 10)),
        5,
        200,
        true,
    );
}

#[test]
fn intimate_reflection_applies_after_minimum_token_reduction() {
    assert_alloc(
        allocate_token_budget(&req("intimate_reflection", 300, 10)),
        3,
        100,
        true,
    );
}

#[test]
fn intimate_reflection_is_capped_by_available_tokens() {
    assert_alloc(
        allocate_token_budget(&req("intimate_reflection", 99, 1)),
        1,
        99,
        false,
    );
}

#[test]
fn intimate_reflection_exact_50_base_becomes_100_and_halves_claims() {
    assert_alloc(
        allocate_token_budget(&req("intimate_reflection", 100, 2)),
        1,
        100,
        true,
    );
}

#[test]
fn quick_lookup_caps_tokens_per_claim_to_100() {
    assert_alloc(
        allocate_token_budget(&req("quick_lookup", 2_000, 10)),
        10,
        100,
        true,
    );
}

#[test]
fn quick_lookup_does_not_modify_when_at_cap() {
    assert_alloc(
        allocate_token_budget(&req("quick_lookup", 1_000, 10)),
        10,
        100,
        false,
    );
}

#[test]
fn quick_lookup_keeps_existing_truncation_from_base_reduction() {
    assert_alloc(
        allocate_token_budget(&req("quick_lookup", 200, 5)),
        4,
        50,
        true,
    );
}

#[test]
fn quick_lookup_with_low_budget_does_not_force_extra_changes() {
    assert_alloc(
        allocate_token_budget(&req("quick_lookup", 120, 2)),
        2,
        60,
        false,
    );
}

#[test]
fn unknown_intent_has_no_effect() {
    assert_alloc(
        allocate_token_budget(&req("totally_unknown", 1_000, 10)),
        10,
        100,
        false,
    );
}

#[test]
fn empty_intent_has_no_effect() {
    assert_alloc(allocate_token_budget(&req("", 1_000, 10)), 10, 100, false);
}

#[test]
fn max_claims_never_exceeds_claims_count() {
    let request = req("intimate_reflection", 50_000, 7);
    let allocation = allocate_token_budget(&request).expect("allocation should succeed");
    assert!(allocation.max_claims <= request.claims_count);
}

#[test]
fn max_tokens_per_claim_never_exceeds_available_tokens() {
    let request = req("intimate_reflection", 51, 1);
    let allocation = allocate_token_budget(&request).expect("allocation should succeed");
    assert!(allocation.max_tokens_per_claim <= request.available_tokens);
}

#[test]
fn intimate_reflection_with_small_budget_stays_bounded() {
    let request = req("intimate_reflection", 60, 5);
    let allocation = allocate_token_budget(&request).expect("allocation should succeed");
    assert!(allocation.max_tokens_per_claim <= request.available_tokens);
    assert!(allocation.max_claims <= request.claims_count);
}

#[test]
fn edge_available_tokens_one_claim_one_results_in_zero_claims() {
    assert_alloc(allocate_token_budget(&req("analyze", 1, 1)), 0, 0, true);
}

#[test]
fn edge_large_token_count_is_handled() {
    assert_alloc(
        allocate_token_budget(&req("analyze", u32::MAX / 2, 2)),
        2,
        (u32::MAX / 2) / 2,
        false,
    );
}

#[test]
fn edge_claims_count_one_with_large_budget_keeps_single_claim() {
    assert_alloc(
        allocate_token_budget(&req("analyze", 50_000, 1)),
        1,
        50_000,
        false,
    );
}

#[test]
fn integer_division_is_truncated_not_rounded() {
    assert_alloc(allocate_token_budget(&req("analyze", 101, 2)), 2, 50, false);
}

#[test]
fn reduction_loop_finds_exact_boundary() {
    assert_alloc(allocate_token_budget(&req("analyze", 100, 6)), 2, 50, true);
}

#[test]
fn allocation_for_nonzero_claims_with_small_budget_can_drop_to_zero_claims() {
    assert_alloc(
        allocate_token_budget(&req("quick_lookup", 10, 3)),
        0,
        0,
        true,
    );
}
