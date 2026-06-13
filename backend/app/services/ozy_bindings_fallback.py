"""Dev-only fallback implementation when compiled `ozy_bindings` is unavailable."""

from __future__ import annotations

import json
from typing import Any


def _max_sensitivity(claims: list[dict[str, Any]]) -> str:
    order = {"S0": 0, "S1": 1, "S2": 2, "S3": 3, "S4": 4}
    best = "S0"
    for claim in claims:
        value = str(claim.get("sensitivity", "S0"))
        if order.get(value, 0) > order.get(best, 0):
            best = value
    return best


def filter_claims(json_input: str) -> str:
    payload = json.loads(json_input)
    claims = payload.get("claims", [])
    return json.dumps({"allowed": claims, "filtered_count": 0, "filter_reasons": []})


def check_payload_sensitivity(json_input: str) -> str:
    del json_input
    return json.dumps("Allowed")


def validate_schema(json_input: str) -> str:
    del json_input
    return json.dumps("SchemaValid")


def check_provenance(json_input: str) -> str:
    payload = json.loads(json_input)
    source_type = str(payload.get("source_type", "model_inferred"))
    auto_confirm = source_type == "user_explicit"
    locked_to_tentative = source_type != "user_confirmed"
    return json.dumps(
        {
            "auto_confirm_eligible": auto_confirm,
            "locked_to_tentative": locked_to_tentative,
        }
    )


def detect_conflicts(proposal_json: str, existing_claims_json: str) -> str:
    del proposal_json
    del existing_claims_json
    return json.dumps({"result": "NoConflict", "matched_claim_id": None})


def resolve_approval(json_input: str) -> str:
    del json_input
    return json.dumps("Approved")


def compute_taint(json_input: str) -> str:
    payload = json.loads(json_input)
    chunks = payload.get("chunks", [])
    return json.dumps(
        {
            "effective_trust": "T2",
            "effective_sensitivity": _max_sensitivity(chunks),
            "is_tainted": False,
            "taint_sources": [],
        }
    )


def check_tainted_action(json_input: str) -> str:
    del json_input
    return json.dumps("Proceed")


def validate_audit_entry(json_input: str) -> str:
    del json_input
    return json.dumps("Valid")


def evaluate_decay(claims_json: str, now: str) -> str:
    del claims_json
    del now
    return json.dumps([])


def check_circuit_breaker(
    config_json: str,
    current_count: int,
    status_json: str,
    seconds_since_last_trip: int | None,
) -> str:
    del config_json
    del current_count
    del status_json
    del seconds_since_last_trip
    return json.dumps("Allow")


def allocate_token_budget(json_input: str) -> str:
    payload = json.loads(json_input)
    available_tokens = int(payload.get("available_tokens", 0))
    claims_count = int(payload.get("claims_count", 0))
    if claims_count <= 0:
        return json.dumps({"max_claims": 0, "max_tokens_per_claim": 0, "truncation_needed": False})
    per_claim = max(1, available_tokens // claims_count)
    return json.dumps(
        {
            "max_claims": claims_count,
            "max_tokens_per_claim": per_claim,
            "truncation_needed": False,
        }
    )
