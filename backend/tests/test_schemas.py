"""Pydantic schema validation tests."""

import pytest
from pydantic import ValidationError

from app.schemas import ClaimData, TokenBudgetRequest
from app.schemas.contracts import U32_MAX, AuthorityClass


def _claim_payload(memory_type: str) -> dict[str, object]:
    return {
        "subject": "user:42",
        "attribute": None,
        "value": "Berlin",
        "content": "User lives in Berlin",
        "memory_type": memory_type,
        "sensitivity": "S1",
        "trust_level": "T2",
        "handling_policy": "local_preferred",
        "verification_state": "tentative",
        "confidence": 0.8,
        "source_type": "user_explicit",
        "source_ref": None,
        "user_locked": False,
        "decay_eligible": True,
        "lifecycle": "temporary",
        "valid_from": None,
        "valid_to": None,
    }


def test_claim_schema_accepts_known_memory_type() -> None:
    claim = ClaimData.model_validate(_claim_payload("profile"))
    assert claim.memory_type == "profile"


def test_claim_schema_accepts_unknown_memory_type_like_rust_other() -> None:
    claim = ClaimData.model_validate(_claim_payload("future_memory_type"))
    assert claim.memory_type == "future_memory_type"


def test_claim_schema_rejects_empty_memory_type() -> None:
    with pytest.raises(ValidationError):
        ClaimData.model_validate(_claim_payload(""))


def test_claim_schema_defaults_the_lane_to_evidence() -> None:
    claim = ClaimData.model_validate(_claim_payload("profile"))
    assert claim.authority_class == AuthorityClass.evidence


def test_claim_schema_rejects_a_field_rust_does_not_know() -> None:
    """Ignoring it would drop a governance flag instead of reporting the mismatch."""
    payload = _claim_payload("profile")
    payload["priority"] = 3

    with pytest.raises(ValidationError):
        ClaimData.model_validate(payload)


def test_token_budget_request_accepts_u32_upper_bound() -> None:
    req = TokenBudgetRequest(
        intent_type="analyze",
        available_tokens=U32_MAX,
        claims_count=U32_MAX,
    )
    assert req.available_tokens == U32_MAX
    assert req.claims_count == U32_MAX


def test_token_budget_request_rejects_available_tokens_over_u32() -> None:
    with pytest.raises(ValidationError):
        TokenBudgetRequest(
            intent_type="analyze",
            available_tokens=U32_MAX + 1,
            claims_count=10,
        )


def test_token_budget_request_rejects_claims_count_over_u32() -> None:
    with pytest.raises(ValidationError):
        TokenBudgetRequest(
            intent_type="analyze",
            available_tokens=10,
            claims_count=U32_MAX + 1,
        )
