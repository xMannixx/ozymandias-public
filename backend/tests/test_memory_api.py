"""API smoke tests for the memory v2 endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_recall_empty_memory_returns_ok(client: AsyncClient) -> None:
    response = await client.get("/memory/recall", params={"query": "Wo wohnt er?"})
    assert response.status_code == 200
    body = response.json()
    assert body["text"] == ""
    assert body["identity"] == []
    assert body["relevant"] == []


@pytest.mark.asyncio
async def test_list_rules_empty(client: AsyncClient) -> None:
    response = await client.get("/memory/rules")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_memory_stats_zeroed(client: AsyncClient) -> None:
    response = await client.get("/memory/stats")
    assert response.status_code == 200
    body = response.json()
    assert body["open_conflicts"] == 0
    assert body["entities"] == 0
    assert body["claims_by_lane"] == {}


@pytest.mark.asyncio
async def test_list_entities_and_relations_empty(client: AsyncClient) -> None:
    assert (await client.get("/memory/entities")).json() == []
    assert (await client.get("/memory/relations")).json() == []
    assert (await client.get("/memory/snippets")).json() == []


@pytest.mark.asyncio
async def test_write_fact_rejects_unknown_lane(client: AsyncClient) -> None:
    payload = {
        "claim": _claim_payload(),
        "lane": "not_a_lane",
    }
    response = await client.post("/memory/facts", json=payload)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_propose_rule_rejects_non_observation_source(client: AsyncClient) -> None:
    payload = {
        "behavior_text": "Antworte immer in Markdown",
        "domain": "format",
        "trigger": {"keywords": ["markdown"]},
        "effect": {"action": "use_markdown", "polarity": "affirm"},
        "source_type": "connector_data",
    }
    response = await client.post("/memory/rules", json=payload)
    assert response.status_code == 400


def _claim_payload() -> dict[str, object]:
    return {
        "subject": "alex",
        "attribute": "wohnort",
        "value": "Berlin",
        "content": "Alex wohnt in Berlin",
        "memory_type": "fact",
        "authority_class": "evidence",
        "sensitivity": "S0",
        "trust_level": "T3",
        "handling_policy": "cloud_ok_encrypted",
        "verification_state": "tentative",
        "confidence": 0.8,
        "source_type": "user_explicit",
        "user_locked": False,
        "decay_eligible": True,
        "lifecycle": "permanent",
    }
