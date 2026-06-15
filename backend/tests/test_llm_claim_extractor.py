"""Tests for claim extractor behavior."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from app.schemas import (
    HandlingPolicy,
    Lifecycle,
    Sensitivity,
    SourceType,
    TrustLevel,
    VerificationState,
)
from app.services.llm.base import LLMMessage, LLMResponse
from app.services.llm.claim_extractor import ClaimExtractor, _apply_defaults, _is_question


@dataclass
class _FakeRouter:
    payload: str
    last_sensitivity: Sensitivity | None = None

    async def route(
        self,
        *,
        intent: str,
        sensitivity: Sensitivity,
        messages: list[LLMMessage],
        tools: list[dict[str, Any]] | None = None,
    ) -> LLMResponse:
        del messages, tools
        assert intent == "claim_extraction"
        self.last_sensitivity = sensitivity
        return LLMResponse(
            content=self.payload,
            model="fake",
            provider="deepseek",
            tokens_used=1,
        )


@pytest.mark.asyncio
async def test_claim_extractor_parses_valid_json() -> None:
    router = _FakeRouter(
        payload=(
            '[{"subject":"user","attribute":"city","value":"Berlin",'
            '"confidence":0.9,"sensitivity":"S1","memory_type":"profile"}]'
        )
    )
    extractor = ClaimExtractor(router=router)
    claims = await extractor.extract(
        llm_response_text="irrelevant",
        original_message="Ich lebe in Berlin",
        sensitivity=Sensitivity.S1,
        turn_id="turn-1",
    )
    assert len(claims) == 1
    assert claims[0].subject == "user"
    assert claims[0].source_type is SourceType.model_inferred
    assert claims[0].verification_state is VerificationState.tentative


@pytest.mark.asyncio
async def test_claim_extractor_returns_empty_on_invalid_json() -> None:
    extractor = ClaimExtractor(router=_FakeRouter(payload="not-json"))
    claims = await extractor.extract(
        llm_response_text="irrelevant",
        original_message="Hello",
        sensitivity=Sensitivity.S1,
        turn_id="turn-1",
    )
    assert claims == []


@pytest.mark.asyncio
async def test_claim_extractor_skips_invalid_items() -> None:
    router = _FakeRouter(
        payload=(
            '[{"subject":"ok","value":"Berlin","confidence":0.7,"sensitivity":"S1","memory_type":"profile"},'
            "42]"
        )
    )
    extractor = ClaimExtractor(router=router)
    claims = await extractor.extract(
        llm_response_text="irrelevant",
        original_message="Ich lebe in Berlin",
        sensitivity=Sensitivity.S1,
        turn_id="turn-1",
    )
    assert len(claims) == 1
    assert claims[0].subject == "ok"


@pytest.mark.asyncio
async def test_claim_extractor_routes_s4_to_router_with_s4() -> None:
    router = _FakeRouter(payload="[]")
    extractor = ClaimExtractor(router=router)
    await extractor.extract(
        llm_response_text="irrelevant",
        original_message="Ich habe trauma erlebt",
        sensitivity=Sensitivity.S4,
        turn_id="turn-1",
    )
    assert router.last_sensitivity is Sensitivity.S4


def test_apply_defaults_sets_contract_enums_for_s4() -> None:
    merged = _apply_defaults(
        {
            "subject": "user",
            "value": "private",
            "sensitivity": "S4",
            "memory_type": "intimate",
            "confidence": 0.2,
        },
        original_message="private text",
        fallback_sensitivity=Sensitivity.S1,
        turn_id="turn-1",
    )
    assert merged["source_type"] is SourceType.model_inferred
    assert merged["trust_level"] is TrustLevel.T1
    assert merged["sensitivity"] is Sensitivity.S4
    assert merged["verification_state"] is VerificationState.tentative
    assert merged["handling_policy"] is HandlingPolicy.s4_isolated
    assert merged["lifecycle"] is Lifecycle.temporary


def test_apply_defaults_sets_trust_and_source_for_explicit_true() -> None:
    merged = _apply_defaults(
        {
            "subject": "user",
            "value": "Berlin",
            "explicit": True,
        },
        original_message="Ich wohne in Berlin",
        fallback_sensitivity=Sensitivity.S1,
        turn_id="turn-2",
    )
    assert merged["trust_level"] is TrustLevel.T3
    assert merged["source_type"] is SourceType.user_explicit


def test_apply_defaults_sets_trust_and_source_for_explicit_false() -> None:
    merged = _apply_defaults(
        {
            "subject": "user",
            "value": "Berlin",
            "explicit": False,
        },
        original_message="Kontext",
        fallback_sensitivity=Sensitivity.S1,
        turn_id="turn-3",
    )
    assert merged["trust_level"] is TrustLevel.T1
    assert merged["source_type"] is SourceType.model_inferred


def test_apply_defaults_uses_inferred_defaults_when_explicit_missing() -> None:
    merged = _apply_defaults(
        {
            "subject": "user",
            "value": "Berlin",
        },
        original_message="Kontext",
        fallback_sensitivity=Sensitivity.S1,
        turn_id="turn-4",
    )
    assert merged["trust_level"] is TrustLevel.T1
    assert merged["source_type"] is SourceType.model_inferred


def test_apply_defaults_normalizes_invalid_memory_type_to_event() -> None:
    merged = _apply_defaults(
        {
            "subject": "user",
            "value": "Ich habe Glutenunvertraeglichkeit",
            "memory_type": "declarative",
        },
        original_message="Ich habe Glutenunvertraeglichkeit",
        fallback_sensitivity=Sensitivity.S1,
        turn_id="turn-5",
    )
    assert merged["memory_type"] == "event"


def test_apply_defaults_keeps_valid_memory_type_health() -> None:
    merged = _apply_defaults(
        {
            "subject": "user",
            "value": "Glutenallergie",
            "memory_type": "health",
        },
        original_message="Ich habe eine Glutenallergie",
        fallback_sensitivity=Sensitivity.S1,
        turn_id="turn-6",
    )
    assert merged["memory_type"] == "health"


# ---------------------------------------------------------------------------
# _is_question unit tests
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "Wie nutzt du das?",
        "wie nutzt du das?",
        "Was ist dein Name?",
        "Warum speicherst du das?",
        "Wo wohnst du?",
        "Wann hast du das gemacht?",
        "Wer bist du?",
        "Welche Modelle nutzt du?",
        "How does this work?",
        "What is your name?",
        "Why did you do that?",
        "Can you help me?",
        "Kannst du mir helfen?",
    ],
)
def test_is_question_returns_true(text: str) -> None:
    assert _is_question(text) is True


@pytest.mark.parametrize(
    "text",
    [
        "Ich bin Manfred.",
        "Merk dir: Ich arbeite bei Arriva.",
        "Mein Projekt heißt Pflanzcheck.",
        "Ich wohne in Berlin.",
        "",
    ],
)
def test_is_question_returns_false(text: str) -> None:
    assert _is_question(text) is False


@pytest.mark.asyncio
async def test_extract_skips_question_with_question_mark() -> None:
    """Questions ending with '?' must yield no claims and skip the LLM call."""
    router = _FakeRouter(payload='[{"subject":"user","value":"x","memory_type":"profile","confidence":0.9,"sensitivity":"S1"}]')
    extractor = ClaimExtractor(router=router)
    claims = await extractor.extract(
        llm_response_text="irrelevant",
        original_message="Wie funktioniert das?",
        sensitivity=Sensitivity.S1,
        turn_id="turn-q1",
    )
    assert claims == []
    assert router.last_sensitivity is None  # router was never called


@pytest.mark.asyncio
async def test_extract_skips_question_word_without_mark() -> None:
    """Questions starting with a question word (no '?') must also yield no claims."""
    router = _FakeRouter(payload="[]")
    extractor = ClaimExtractor(router=router)
    claims = await extractor.extract(
        llm_response_text="irrelevant",
        original_message="Wie nutze ich das",
        sensitivity=Sensitivity.S1,
        turn_id="turn-q2",
    )
    assert claims == []
    assert router.last_sensitivity is None


@pytest.mark.asyncio
async def test_extract_does_not_skip_statement() -> None:
    """Normal statements must still reach the router and return claims."""
    router = _FakeRouter(
        payload='[{"subject":"user","attribute":"name","value":"Manfred","confidence":0.95,"sensitivity":"S2","memory_type":"profile","explicit":true}]'
    )
    extractor = ClaimExtractor(router=router)
    claims = await extractor.extract(
        llm_response_text="irrelevant",
        original_message="Ich heiße Manfred.",
        sensitivity=Sensitivity.S2,
        turn_id="turn-q3",
    )
    assert len(claims) == 1
    assert claims[0].subject == "user"
    assert router.last_sensitivity is Sensitivity.S2
