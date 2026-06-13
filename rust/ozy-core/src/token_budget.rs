use ozy_contracts::{OzyError, TokenBudgetAllocation, TokenBudgetRequest};

pub fn allocate_token_budget(
    request: &TokenBudgetRequest,
) -> Result<TokenBudgetAllocation, OzyError> {
    if request.available_tokens == 0 {
        return Err(OzyError::InvariantViolation {
            message: "available_tokens must be > 0".to_owned(),
        });
    }

    if request.claims_count == 0 {
        return Ok(TokenBudgetAllocation {
            max_claims: 0,
            max_tokens_per_claim: 0,
            truncation_needed: false,
        });
    }

    let mut max_claims = request.claims_count;
    let mut max_tokens_per_claim = request.available_tokens / request.claims_count;
    let mut truncation_needed = false;

    if max_tokens_per_claim < 50 {
        truncation_needed = true;

        if request.available_tokens < 50 {
            max_claims = 0;
            max_tokens_per_claim = 0;
        } else {
            max_claims = (request.available_tokens / 50).min(request.claims_count);
            max_tokens_per_claim = request
                .available_tokens
                .checked_div(max_claims)
                .unwrap_or(0);
        }
    }

    match request.intent_type.as_str() {
        "intimate_reflection" => {
            let doubled = max_tokens_per_claim.saturating_mul(2);
            max_tokens_per_claim = doubled.min(request.available_tokens);
            max_claims = request
                .available_tokens
                .checked_div(max_tokens_per_claim)
                .map_or(0, |v| max_claims.min(v));
            if max_claims < request.claims_count {
                truncation_needed = true;
            }
        }
        "quick_lookup" if max_tokens_per_claim > 100 => {
            max_tokens_per_claim = 100;
            truncation_needed = true;
        }
        "quick_lookup" => {}
        _ => {}
    }

    max_claims = max_claims.min(request.claims_count);
    max_tokens_per_claim = max_tokens_per_claim.min(request.available_tokens);

    if max_claims == 0 {
        max_tokens_per_claim = 0;
    }

    Ok(TokenBudgetAllocation {
        max_claims,
        max_tokens_per_claim,
        truncation_needed,
    })
}
