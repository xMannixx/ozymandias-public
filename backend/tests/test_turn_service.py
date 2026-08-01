"""Unit tests for turn pipeline service."""

from __future__ import annotations

import uuid
from decimal import Decimal
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usage import LLMUsageEvent
from app.schemas import (
    ClaimData,
    G2Result,
    G3Result,
    HandlingPolicy,
    Lifecycle,
    Sensitivity,
    SensitivityFilterInput,
    SensitivityFilterOutput,
    SourceType,
    TaintSummary,
    TrustLevel,
    VerificationState,
)
from app.schemas.api_models import TurnAttachment, TurnRequest
from app.schemas.contracts import (
    ConflictResultConflictGroupPayload,
    ConflictResultConflictGroupVariant,
)
from app.services.errors import (
    CircuitBreakerTrippedError,
    LiveWebPermissionRequiredError,
    LocalProviderUnavailableError,
)
from app.services.live_web_service import LiveWebContext
from app.services.llm.base import LLMResponse
from app.services.llm.sensitivity_classifier import SensitivityClassification
from app.services.llm.system_prompt import OZY_SYSTEM_PROMPT, build_system_prompt
from app.services.llm.usage import LLMCallUsage
from app.services.project_context_service import ProjectContext
from app.services.turn_service import TurnService
from tests.conftest import FakeAsyncSession


def _claim() -> ClaimData:
    return ClaimData(
        subject="user:42",
        attribute="city",
        value="Berlin",
        content="User lives in Berlin",
        memory_type="profile",
        sensitivity=Sensitivity.S1,
        trust_level=TrustLevel.T3,
        handling_policy=HandlingPolicy.local_preferred,
        verification_state=VerificationState.tentative,
        confidence=0.9,
        source_type=SourceType.user_explicit,
        source_ref="turn-1",
        user_locked=False,
        decay_eligible=True,
        lifecycle=Lifecycle.temporary,
        valid_from=None,
        valid_to=None,
    )


def _patch_default_rust(monkeypatch: pytest.MonkeyPatch, *, claims: list[ClaimData]) -> None:
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.filter_claims",
        lambda _payload: SensitivityFilterOutput(
            allowed=claims, filtered_count=0, filter_reasons=[]
        ),
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.compute_taint",
        lambda _payload: TaintSummary(
            effective_trust=TrustLevel.T3,
            effective_sensitivity=Sensitivity.S1,
            is_tainted=False,
            taint_sources=[],
        ),
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.validate_schema", lambda _payload: "SchemaValid"
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.check_provenance",
        lambda _payload: G2Result(auto_confirm_eligible=True, locked_to_tentative=False),
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.detect_conflicts",
        lambda _proposal, _existing: G3Result(result="NoConflict", matched_claim_id=None),
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.resolve_approval", lambda _payload: "Approved"
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.check_tainted_action", lambda _payload: "Proceed"
    )


def _prepare_service(service: TurnService) -> None:
    service.audit.log = AsyncMock()  # type: ignore[method-assign]
    service.claim_service.list_claims = AsyncMock(return_value=[])  # type: ignore[method-assign]
    service.claim_service.create_claim_from_proposal = AsyncMock(  # type: ignore[method-assign]
        return_value=SimpleNamespace(claim_id=uuid.uuid4())
    )
    service.proposal_service.create_proposal = AsyncMock(  # type: ignore[method-assign]
        return_value=SimpleNamespace(proposal_id=uuid.uuid4())
    )
    service.circuit_breaker.check = AsyncMock()  # type: ignore[method-assign]
    service.circuit_breaker.increment = AsyncMock(return_value=1)  # type: ignore[method-assign]


def _patch_context_assembler(
    monkeypatch: pytest.MonkeyPatch,
    *,
    context_block: str = (
        "<user_context>\nNo claims, projects or contacts stored yet. Memory is empty.\n"
        "</user_context>"
    ),
) -> AsyncMock:
    assemble_mock = AsyncMock(return_value=context_block)
    monkeypatch.setattr("app.services.turn_service.ContextAssembler.assemble", assemble_mock)
    return assemble_mock


@pytest.mark.asyncio
async def test_process_turn_with_no_claims(monkeypatch: pytest.MonkeyPatch) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[])

    result = await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="hello", claims=[]),
    )
    assert result.claims_processed == 0
    assert result.results == []
    assert result.response_text is None


@pytest.mark.asyncio
async def test_process_turn_creates_claim_when_auto_approved(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[_claim()])

    result = await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="hello", claims=[_claim()])
    )
    assert result.claims_processed == 1
    assert result.results[0].status == "created"


@pytest.mark.asyncio
async def test_process_turn_rejects_on_schema_error(monkeypatch: pytest.MonkeyPatch) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[_claim()])
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.validate_schema",
        lambda _payload: {"SchemaError": {"errors": ["missing field"]}},
    )

    result = await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="hello", claims=[_claim()])
    )
    assert result.results[0].status == "rejected"


@pytest.mark.asyncio
async def test_process_turn_rejects_when_taint_blocks(monkeypatch: pytest.MonkeyPatch) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[_claim()])
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.check_tainted_action",
        lambda _payload: {"Block": {"reason": "tainted"}},
    )

    result = await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="hello", claims=[_claim()])
    )
    assert result.results[0].status == "rejected"
    assert "tainted" in (result.results[0].reason or "")


@pytest.mark.asyncio
async def test_process_turn_rejects_when_approval_denied(monkeypatch: pytest.MonkeyPatch) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[_claim()])
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.resolve_approval",
        lambda _payload: {"Denied": {"reason": "manual deny"}},
    )

    result = await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="hello", claims=[_claim()])
    )
    assert result.results[0].status == "rejected"


@pytest.mark.asyncio
async def test_process_turn_creates_proposal_when_hitl_required(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[_claim()])
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.check_provenance",
        lambda _payload: G2Result(auto_confirm_eligible=False, locked_to_tentative=True),
    )

    result = await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="hello", claims=[_claim()])
    )
    assert result.results[0].status == "proposal_created"


@pytest.mark.asyncio
async def test_process_turn_creates_proposal_on_conflict_group(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[_claim()])
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.detect_conflicts",
        lambda _proposal, _existing: G3Result(
            result=ConflictResultConflictGroupVariant(
                ConflictGroup=ConflictResultConflictGroupPayload(
                    claim_ids=["00000000-0000-0000-0000-000000000001"]
                )
            ),
            matched_claim_id=None,
        ),
    )
    service.db.refresh = AsyncMock(  # type: ignore[method-assign]
        side_effect=lambda obj: setattr(obj, "group_id", uuid.uuid4())
    )

    result = await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="hello", claims=[_claim()])
    )
    assert result.results[0].status == "proposal_created"


@pytest.mark.asyncio
async def test_process_turn_adds_filtered_out_results(monkeypatch: pytest.MonkeyPatch) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.filter_claims",
        lambda _payload: SensitivityFilterOutput(
            allowed=[],
            filtered_count=2,
            filter_reasons=["ProviderNotLocal", "ProviderNotEncrypted"],
        ),
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.compute_taint",
        lambda _payload: TaintSummary(
            effective_trust=TrustLevel.T3,
            effective_sensitivity=Sensitivity.S1,
            is_tainted=False,
            taint_sources=[],
        ),
    )

    result = await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="hello", claims=[_claim()])
    )
    statuses = [item.status for item in result.results]
    assert statuses == ["filtered_out", "filtered_out"]


@pytest.mark.asyncio
async def test_process_turn_calls_circuit_breaker_increment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[])

    await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello", claims=[]))
    assert service.circuit_breaker.increment.await_count == 1  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_process_turn_logs_failure_and_reraises(monkeypatch: pytest.MonkeyPatch) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    service.circuit_breaker.check = (  # type: ignore[method-assign]
        AsyncMock(side_effect=CircuitBreakerTrippedError("blocked"))
    )

    with pytest.raises(CircuitBreakerTrippedError):
        await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello", claims=[]))
    assert service.audit.log.await_count >= 1  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_process_turn_persists_what_the_llm_calls_consumed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = FakeAsyncSession()
    service = TurnService(cast(AsyncSession, session))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])

    async def _route(**kwargs: object) -> LLMResponse:
        sink = cast(list[LLMCallUsage] | None, kwargs["usage_sink"])
        assert sink is not None
        sink.append(
            LLMCallUsage(
                call_type="chat",
                provider="openai",
                model="gpt-4o",
                status="ok",
                latency_ms=900,
                prompt_tokens=1_000_000,
                completion_tokens=100_000,
                cached_prompt_tokens=500_000,
                total_tokens=1_100_000,
            )
        )
        return LLMResponse(content="ok", model="gpt-4o", provider="openai", tokens_used=1_100_000)

    service.llm_router.route = AsyncMock(side_effect=_route)  # type: ignore[method-assign]
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))

    events = [row for row in session.added if isinstance(row, LLMUsageEvent)]
    assert len(events) == 1
    assert events[0].provider == "openai"
    assert events[0].total_tokens == 1_100_000
    assert events[0].cost_usd == Decimal("2.875000")
    assert events[0].turn_id is not None


@pytest.mark.asyncio
async def test_process_turn_persists_usage_even_when_the_turn_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A crashed turn still burned tokens, so the failed attempt must be visible."""
    session = FakeAsyncSession()
    service = TurnService(cast(AsyncSession, session))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])

    async def _route(**kwargs: object) -> LLMResponse:
        sink = cast(list[LLMCallUsage] | None, kwargs["usage_sink"])
        assert sink is not None
        sink.append(
            LLMCallUsage(
                call_type="chat",
                provider="openai",
                model="gpt-4o",
                status="error",
                latency_ms=300,
                error_kind="ConnectionError",
            )
        )
        raise ConnectionError("connection refused")

    service.llm_router.route = AsyncMock(side_effect=_route)  # type: ignore[method-assign]

    with pytest.raises(ConnectionError):
        await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))

    events = [row for row in session.added if isinstance(row, LLMUsageEvent)]
    assert [(event.status, event.error_kind) for event in events] == [("error", "ConnectionError")]


@pytest.mark.asyncio
async def test_process_turn_uses_llm_and_claim_extractor_when_no_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.filter_claims",
        lambda payload: SensitivityFilterOutput(
            allowed=payload.claims,
            filtered_count=0,
            filter_reasons=[],
        ),
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.compute_taint",
        lambda _payload: TaintSummary(
            effective_trust=TrustLevel.T3,
            effective_sensitivity=Sensitivity.S1,
            is_tainted=False,
            taint_sources=[],
        ),
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.validate_schema",
        lambda _payload: "SchemaValid",
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.check_provenance",
        lambda _payload: G2Result(auto_confirm_eligible=True, locked_to_tentative=False),
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.detect_conflicts",
        lambda _proposal, _existing: G3Result(result="NoConflict", matched_claim_id=None),
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.resolve_approval", lambda _payload: "Approved"
    )
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.check_tainted_action", lambda _payload: "Proceed"
    )

    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="response",
            model="deepseek-chat",
            provider="deepseek",
            tokens_used=10,
        )
    )
    service.claim_extractor.extract = (  # type: ignore[method-assign]
        AsyncMock(return_value=[_claim()])
    )

    result = await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))
    assert result.claims_processed == 1
    assert result.response_text == "response"
    assert result.results[0].status == "created"
    assert service.llm_router.route.await_count == 1
    assert service.claim_extractor.extract.await_count == 1


@pytest.mark.asyncio
async def test_process_turn_passes_reasoning_content_from_llm(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="final answer",
            model="deepseek-reasoner",
            provider="deepseek",
            tokens_used=42,
            reasoning_content="step one; step two",
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    result = await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))
    assert result.response_text == "final answer"
    assert result.reasoning_content == "step one; step two"


@pytest.mark.asyncio
async def test_process_turn_routes_high_sensitivity_locally(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)

    def _filter(payload: object) -> SensitivityFilterOutput:
        input_payload = cast(SensitivityFilterInput, payload)
        assert input_payload.provider_is_local is True
        return SensitivityFilterOutput(allowed=[], filtered_count=0, filter_reasons=[])

    monkeypatch.setattr("app.services.turn_service.rust_bridge.filter_claims", _filter)
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.compute_taint",
        lambda _payload: TaintSummary(
            effective_trust=TrustLevel.T3,
            effective_sensitivity=Sensitivity.S4,
            is_tainted=False,
            taint_sources=[],
        ),
    )

    async def _route(**kwargs: object) -> LLMResponse:
        assert kwargs["sensitivity"] is Sensitivity.S4
        return LLMResponse(
            content="response",
            model="llama3",
            provider="ollama",
            tokens_used=5,
        )

    service.llm_router.route = AsyncMock(side_effect=_route)  # type: ignore[method-assign]
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    result = await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="Ich habe trauma erlebt"),
    )
    assert result.claims_processed == 0


@pytest.mark.asyncio
async def test_process_turn_passes_allow_s3_cloud_fallback_to_sensitivity_filter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)

    def _filter(payload: object) -> SensitivityFilterOutput:
        input_payload = cast(SensitivityFilterInput, payload)
        assert input_payload.allow_s3_cloud_fallback is True
        return SensitivityFilterOutput(allowed=[], filtered_count=0, filter_reasons=[])

    monkeypatch.setattr("app.services.turn_service.rust_bridge.filter_claims", _filter)
    monkeypatch.setattr(
        "app.services.turn_service.rust_bridge.compute_taint",
        lambda _payload: TaintSummary(
            effective_trust=TrustLevel.T3,
            effective_sensitivity=Sensitivity.S3,
            is_tainted=False,
            taint_sources=[],
        ),
    )
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(
            return_value=SensitivityClassification(
                sensitivity=Sensitivity.S3,
                source="keyword",
                local_classifier_available=True,
            )
        ),
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="deepseek-chat",
            provider="deepseek",
            tokens_used=10,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="mein gehalt ist privat", allow_s3_cloud_fallback=True),
    )


@pytest.mark.asyncio
async def test_process_turn_uses_settings_provider_preferences(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(return_value=Sensitivity.S1),
    )
    monkeypatch.setattr(
        "app.services.turn_service.SettingsService.get_or_create",
        AsyncMock(
            return_value=SimpleNamespace(
                kill_switch=False,
                preferred_provider="openai",
                preferred_model="gpt-4o",
            )
        ),
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="gpt-4o",
            provider="openai",
            tokens_used=12,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    result = await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))
    assert result.provider == "openai"
    assert result.model == "gpt-4o"
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    assert route_call.kwargs["preferred_provider"] == "openai"
    assert route_call.kwargs["preferred_model"] == "gpt-4o"


@pytest.mark.asyncio
async def test_process_turn_payload_override_has_priority_over_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(return_value=Sensitivity.S1),
    )
    monkeypatch.setattr(
        "app.services.turn_service.SettingsService.get_or_create",
        AsyncMock(
            return_value=SimpleNamespace(
                kill_switch=False,
                preferred_provider="openai",
                preferred_model="gpt-4o",
            )
        ),
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="deepseek-chat",
            provider="deepseek",
            tokens_used=10,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="hello", provider="deepseek", model="deepseek-chat"),
    )
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    assert route_call.kwargs["preferred_provider"] == "deepseek"
    assert route_call.kwargs["preferred_model"] == "deepseek-chat"


@pytest.mark.asyncio
async def test_process_turn_ignores_non_local_override_for_s4(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    monkeypatch.setattr(
        "app.services.turn_service.SettingsService.get_or_create",
        AsyncMock(
            return_value=SimpleNamespace(
                kill_switch=False,
                preferred_provider="openai",
                preferred_model="gpt-4o",
            )
        ),
    )
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(return_value=Sensitivity.S4),
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="llama3.1:8b",
            provider="ollama",
            tokens_used=9,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="sensitive text", provider="openai", model="gpt-4o"),
    )
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    assert route_call.kwargs["preferred_provider"] is None
    assert route_call.kwargs["preferred_model"] is None


@pytest.mark.asyncio
async def test_process_turn_raises_s3_local_unavailable_without_fallback_flag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(
            return_value=SensitivityClassification(
                sensitivity=Sensitivity.S3,
                source="keyword",
                local_classifier_available=True,
            )
        ),
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        side_effect=LocalProviderUnavailableError(
            provider="ollama",
            sensitivity="S3",
            fallback_allowed=True,
            detail="connection refused",
        )
    )

    with pytest.raises(LocalProviderUnavailableError):
        await service.process_turn(
            user_id="user-1",
            payload=TurnRequest(text="mein gehalt ist privat"),
        )

    route_call = service.llm_router.route.await_args
    assert route_call is not None
    assert route_call.kwargs["enforce_local"] is True


@pytest.mark.asyncio
async def test_process_turn_allows_cloud_when_s3_fallback_flag_is_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(
            return_value=SensitivityClassification(
                sensitivity=Sensitivity.S3,
                source="keyword",
                local_classifier_available=True,
            )
        ),
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="deepseek-chat",
            provider="deepseek",
            tokens_used=10,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    result = await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(
            text="mein gehalt ist privat",
            allow_s3_cloud_fallback=True,
            provider="deepseek",
            model="deepseek-chat",
        ),
    )

    assert result.provider == "deepseek"
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    assert route_call.kwargs["enforce_local"] is False


@pytest.mark.asyncio
async def test_process_turn_keeps_s4_local_even_with_fallback_flag(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(
            return_value=SensitivityClassification(
                sensitivity=Sensitivity.S4,
                source="keyword",
                local_classifier_available=True,
            )
        ),
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        side_effect=LocalProviderUnavailableError(
            provider="ollama",
            sensitivity="S4",
            fallback_allowed=False,
            detail="connection refused",
        )
    )

    with pytest.raises(LocalProviderUnavailableError):
        await service.process_turn(
            user_id="user-1",
            payload=TurnRequest(
                text="intim",
                allow_s3_cloud_fallback=True,
                provider="deepseek",
                model="deepseek-chat",
            ),
        )

    route_call = service.llm_router.route.await_args
    assert route_call is not None
    assert route_call.kwargs["enforce_local"] is True


@pytest.mark.asyncio
async def test_process_turn_requires_confirmation_for_s3_live_web(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[])
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(
            return_value=SensitivityClassification(
                sensitivity=Sensitivity.S3,
                source="keyword",
                local_classifier_available=True,
            )
        ),
    )
    monkeypatch.setattr(
        "app.services.turn_service.SettingsService.get_or_create",
        AsyncMock(
            return_value=SimpleNamespace(
                kill_switch=False,
                preferred_provider=None,
                preferred_model=None,
                preferred_local_provider=None,
                preferred_local_model=None,
                live_web_enabled=True,
                live_web_mode="provider_native_first",
                live_web_s3_confirmed_default=False,
            )
        ),
    )

    with pytest.raises(LiveWebPermissionRequiredError):
        await service.process_turn(
            user_id="user-1",
            payload=TurnRequest(text="neueste marktpreise", claims=[]),
        )


@pytest.mark.asyncio
async def test_process_turn_runs_live_web_for_confirmed_s3(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[])
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(
            return_value=SensitivityClassification(
                sensitivity=Sensitivity.S3,
                source="keyword",
                local_classifier_available=True,
            )
        ),
    )
    monkeypatch.setattr(
        "app.services.turn_service.SettingsService.get_or_create",
        AsyncMock(
            return_value=SimpleNamespace(
                kill_switch=False,
                preferred_provider=None,
                preferred_model=None,
                preferred_local_provider=None,
                preferred_local_model=None,
                live_web_enabled=True,
                live_web_mode="provider_native_first",
                live_web_s3_confirmed_default=False,
            )
        ),
    )
    service.live_web_service.search = AsyncMock(  # type: ignore[method-assign]
        return_value=LiveWebContext(strategy="connector", sources=[])
    )

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="neueste marktpreise", claims=[], allow_s3_live_web=True),
    )

    assert service.live_web_service.search.await_count == 1


@pytest.mark.asyncio
async def test_process_turn_sends_ozy_system_message_first(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="deepseek-chat",
            provider="deepseek",
            tokens_used=5,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    messages = route_call.kwargs["messages"]
    assert messages[0]["role"] == "system"


@pytest.mark.asyncio
async def test_process_turn_system_message_contains_ozymandias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="deepseek-chat",
            provider="deepseek",
            tokens_used=5,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    messages = route_call.kwargs["messages"]
    assert "Ozymandias" in messages[0]["content"]
    assert "Ozymandias" in OZY_SYSTEM_PROMPT


@pytest.mark.asyncio
async def test_process_turn_system_message_uses_neutral_owner_label(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="deepseek-chat",
            provider="deepseek",
            tokens_used=5,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    messages = route_call.kwargs["messages"]
    former_owner_name = "Ma" + "nni"
    assert "dein Owner" in messages[0]["content"]
    assert former_owner_name not in messages[0]["content"]
    assert "dein Owner" in OZY_SYSTEM_PROMPT
    assert former_owner_name not in OZY_SYSTEM_PROMPT


def test_build_system_prompt_can_render_configured_owner() -> None:
    prompt = build_system_prompt(
        {
            "name": "Alex",
            "profile": "Softwareentwicklung",
            "language": "Deutsch",
        }
    )

    assert "Alex" in prompt
    assert "Softwareentwicklung" in prompt
    assert ("Ma" + "nni") not in prompt


@pytest.mark.asyncio
async def test_process_turn_injects_context_block_as_second_system_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[])
    custom_context = (
        '<user_context>\n<projects count="1">Projekt: Ozymandias</projects>\n</user_context>'
    )
    assemble_mock = _patch_context_assembler(monkeypatch, context_block=custom_context)
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="deepseek-chat",
            provider="deepseek",
            tokens_used=5,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="Welche Projekte habe ich?")
    )
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    messages = route_call.kwargs["messages"]
    assert messages[1]["role"] == "system"
    assert messages[1]["content"] == custom_context
    assemble_args = assemble_mock.await_args
    assert assemble_args is not None
    assert assemble_args.kwargs["user_id"] == "user-1"


@pytest.mark.asyncio
async def test_process_turn_persists_chat_messages_to_conversation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    conversation = SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    service.conversation_service.create_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=conversation
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="answer",
            model="llama3",
            provider="ollama",
            tokens_used=5,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    result = await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))
    assert result.conversation_id == str(conversation.conversation_id)
    assert service.conversation_service.create_conversation.await_count == 1
    append_calls = service.conversation_service.append_message.await_args_list
    assert [call.kwargs["role"] for call in append_calls] == ["user", "assistant"]
    assert append_calls[0].kwargs["content"] == "hello"
    assert append_calls[1].kwargs["content"] == "answer"
    assert append_calls[1].kwargs["provider"] == "ollama"


@pytest.mark.asyncio
async def test_process_turn_injects_conversation_history_into_llm_messages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    conversation = SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    service.conversation_service.get_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=conversation
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]
    service.conversation_service.recent_history = AsyncMock(  # type: ignore[method-assign]
        return_value=[
            SimpleNamespace(role="user", content="earlier question"),
            SimpleNamespace(role="assistant", content="earlier answer"),
        ]
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="answer",
            model="llama3",
            provider="ollama",
            tokens_used=5,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="follow-up", conversation_id=str(conversation.conversation_id)),
    )
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    messages = route_call.kwargs["messages"]
    contents = [message["content"] for message in messages]
    assert "earlier question" in contents
    assert "earlier answer" in contents
    assert contents.index("earlier question") < contents.index("follow-up")


def _patch_project_context(
    monkeypatch: pytest.MonkeyPatch,
    *,
    sensitivity: str = "S1",
    force_local: bool = False,
    knowledge_files: list[str] | None = None,
) -> ProjectContext:
    context = ProjectContext(
        project_id="11111111-1111-1111-1111-111111111111",
        project_name="Ozymandias",
        sensitivity=sensitivity,
        force_local=force_local,
        text='<workspace name="Ozymandias" sensitivity="S1">\nspec says JSON\n</workspace>',
        knowledge_files=knowledge_files or ["spec.md"],
        knowledge_chars=42,
    )
    monkeypatch.setattr(
        "app.services.turn_service.ProjectContextService.build",
        AsyncMock(return_value=context),
    )
    return context


@pytest.mark.asyncio
async def test_process_turn_injects_workspace_block_ahead_of_general_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    context = _patch_project_context(monkeypatch)
    service.conversation_service.create_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(content="answer", model="llama3", provider="ollama", tokens_used=5)
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="what does the spec say?", project_id=context.project_id),
    )

    messages = service.llm_router.route.await_args.kwargs["messages"]
    assert messages[1]["content"] == context.text
    assert "<user_context>" in messages[2]["content"]


@pytest.mark.asyncio
async def test_process_turn_omits_project_overview_inside_a_workspace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    assemble_mock = _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    context = _patch_project_context(monkeypatch)
    service.conversation_service.create_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(content="answer", model="llama3", provider="ollama", tokens_used=5)
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="status?", project_id=context.project_id),
    )

    assert assemble_mock.await_args.kwargs["include_projects"] is False


@pytest.mark.asyncio
async def test_sensitive_workspace_forces_local_routing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    context = _patch_project_context(monkeypatch, sensitivity="S3", force_local=True)
    service.conversation_service.create_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(content="answer", model="llama3", provider="ollama", tokens_used=5)
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(
            text="harmless question",
            project_id=context.project_id,
            provider="openai",
        ),
    )

    route_kwargs = service.llm_router.route.await_args.kwargs
    assert route_kwargs["enforce_local"] is True
    # A cloud provider must not survive a local-only workspace.
    assert route_kwargs["preferred_provider"] is None


@pytest.mark.asyncio
async def test_turn_audit_records_injected_workspace_knowledge(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    context = _patch_project_context(monkeypatch, knowledge_files=["spec.md", "notes.txt"])
    service.conversation_service.create_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(content="answer", model="llama3", provider="ollama", tokens_used=5)
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="hello", project_id=context.project_id),
    )

    audit_payload = service.audit.log.await_args.kwargs["payload"]
    assert audit_payload["project_id"] == context.project_id
    assert audit_payload["project_knowledge_files"] == ["spec.md", "notes.txt"]
    assert audit_payload["project_knowledge_chars"] == 42


@pytest.mark.asyncio
async def test_new_chat_inside_a_workspace_is_linked_to_it(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    context = _patch_project_context(monkeypatch)
    service.conversation_service.create_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(content="answer", model="llama3", provider="ollama", tokens_used=5)
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="hello", project_id=context.project_id),
    )

    create_kwargs = service.conversation_service.create_conversation.await_args.kwargs
    assert create_kwargs["project_id"] == context.project_id


@pytest.mark.asyncio
async def test_existing_chat_keeps_its_workspace_without_an_explicit_project(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    build_mock = AsyncMock(
        return_value=ProjectContext(
            project_id="22222222-2222-2222-2222-222222222222",
            project_name="Ozymandias",
            sensitivity="S1",
            force_local=False,
            text="<workspace/>",
        )
    )
    monkeypatch.setattr("app.services.turn_service.ProjectContextService.build", build_mock)
    conversation = SimpleNamespace(
        conversation_id=uuid.uuid4(),
        project_id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
    )
    service.conversation_service.get_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=conversation
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]
    service.conversation_service.recent_history = AsyncMock(  # type: ignore[method-assign]
        return_value=[]
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(content="answer", model="llama3", provider="ollama", tokens_used=5)
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1",
        payload=TurnRequest(text="follow-up", conversation_id=str(conversation.conversation_id)),
    )

    assert build_mock.await_args.kwargs["project_id"] == str(conversation.project_id)


@pytest.mark.asyncio
async def test_turns_without_a_project_skip_workspace_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    assemble_mock = _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    build_mock = AsyncMock()
    monkeypatch.setattr("app.services.turn_service.ProjectContextService.build", build_mock)
    service.conversation_service.create_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(content="answer", model="llama3", provider="ollama", tokens_used=5)
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(user_id="user-1", payload=TurnRequest(text="hello"))

    build_mock.assert_not_awaited()
    assert assemble_mock.await_args.kwargs["include_projects"] is True


@pytest.mark.asyncio
async def test_process_turn_with_claims_override_skips_conversation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[])
    service.conversation_service.create_conversation = AsyncMock()  # type: ignore[method-assign]
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]

    result = await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="hello", claims=[])
    )
    assert result.conversation_id is None
    assert service.conversation_service.create_conversation.await_count == 0
    assert service.conversation_service.append_message.await_count == 0


@pytest.mark.asyncio
async def test_process_turn_includes_attachments_in_user_message_and_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    conversation = SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    service.conversation_service.create_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=conversation
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]

    classify_mock = AsyncMock(
        return_value=SensitivityClassification(
            sensitivity=Sensitivity.S1,
            source="keyword",
            local_classifier_available=True,
        )
    )
    monkeypatch.setattr("app.services.turn_service.classify_sensitivity", classify_mock)
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="summary",
            model="llama3",
            provider="ollama",
            tokens_used=5,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    payload = TurnRequest(
        text="Summarize this file",
        attachments=[TurnAttachment(filename="notes.txt", content="meeting agenda content")],
    )
    await service.process_turn(user_id="user-1", payload=payload)

    # Classification saw the attachment content.
    classify_args = classify_mock.await_args
    assert classify_args is not None
    assert "meeting agenda content" in classify_args.args[0]

    # LLM user message contains the attachment block.
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    user_message = route_call.kwargs["messages"][-1]
    assert user_message["role"] == "user"
    assert "[Attachment: notes.txt]" in user_message["content"]
    assert "meeting agenda content" in user_message["content"]

    # Persisted user message keeps the attachment content for future context.
    append_calls = service.conversation_service.append_message.await_args_list
    assert "[Attachment: notes.txt]" in append_calls[0].kwargs["content"]


@pytest.mark.asyncio
async def test_process_turn_stream_yields_deltas_and_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)
    _patch_default_rust(monkeypatch, claims=[])
    conversation = SimpleNamespace(conversation_id=uuid.uuid4(), project_id=None)
    service.conversation_service.create_conversation = AsyncMock(  # type: ignore[method-assign]
        return_value=conversation
    )
    service.conversation_service.append_message = AsyncMock()  # type: ignore[method-assign]

    async def _fake_stream(**kwargs: object) -> object:
        yield "Hel"
        yield "lo"
        yield LLMResponse(
            content="Hello",
            model="llama3",
            provider="ollama",
            tokens_used=5,
        )

    monkeypatch.setattr(service.llm_router, "route_stream", _fake_stream)
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    events = [
        event
        async for event in service.process_turn_stream(
            user_id="user-1", payload=TurnRequest(text="hello")
        )
    ]
    assert [event["event"] for event in events] == ["delta", "delta", "result"]
    assert events[0]["data"] == {"text": "Hel"}
    assert events[1]["data"] == {"text": "lo"}
    result_data = events[2]["data"]
    assert result_data["response_text"] == "Hello"
    assert result_data["provider"] == "ollama"
    assert result_data["conversation_id"] == str(conversation.conversation_id)
    append_calls = service.conversation_service.append_message.await_args_list
    assert [call.kwargs["role"] for call in append_calls] == ["user", "assistant"]


@pytest.mark.asyncio
async def test_process_turn_stream_yields_error_event_on_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    service.circuit_breaker.check = (  # type: ignore[method-assign]
        AsyncMock(side_effect=CircuitBreakerTrippedError("blocked"))
    )

    events = [
        event
        async for event in service.process_turn_stream(
            user_id="user-1", payload=TurnRequest(text="hello")
        )
    ]
    assert len(events) == 1
    assert events[0]["event"] == "error"
    assert events[0]["data"]["code"] == "circuit_breaker_tripped"
    assert service.audit.log.await_count >= 1  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_process_turn_stream_maps_local_provider_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_context_assembler(monkeypatch)

    async def _failing_stream(**kwargs: object) -> object:
        raise LocalProviderUnavailableError(
            provider="ollama",
            sensitivity="S3",
            fallback_allowed=True,
            detail="connection refused",
        )
        yield ""  # pragma: no cover - makes this an async generator

    monkeypatch.setattr(service.llm_router, "route_stream", _failing_stream)
    monkeypatch.setattr(
        "app.services.turn_service.classify_sensitivity",
        AsyncMock(
            return_value=SensitivityClassification(
                sensitivity=Sensitivity.S3,
                source="keyword",
                local_classifier_available=True,
            )
        ),
    )

    events = [
        event
        async for event in service.process_turn_stream(
            user_id="user-1", payload=TurnRequest(text="mein gehalt ist privat")
        )
    ]
    assert events[-1]["event"] == "error"
    assert events[-1]["data"]["code"] == "local_provider_unavailable"
    assert events[-1]["data"]["fallback_allowed"] is True


@pytest.mark.asyncio
async def test_process_turn_injects_empty_context_when_memory_is_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = TurnService(cast(AsyncSession, FakeAsyncSession()))
    _prepare_service(service)
    _patch_default_rust(monkeypatch, claims=[])
    _patch_context_assembler(
        monkeypatch,
        context_block=(
            "<user_context>\n"
            "Keine Claims, Projekte oder Kontakte gespeichert. Memory ist leer.\n"
            "</user_context>"
        ),
    )
    service.llm_router.route = AsyncMock(  # type: ignore[method-assign]
        return_value=LLMResponse(
            content="ok",
            model="deepseek-chat",
            provider="deepseek",
            tokens_used=5,
        )
    )
    service.claim_extractor.extract = AsyncMock(return_value=[])  # type: ignore[method-assign]

    await service.process_turn(
        user_id="user-1", payload=TurnRequest(text="Was weisst du ueber mich?")
    )
    route_call = service.llm_router.route.await_args
    assert route_call is not None
    messages = route_call.kwargs["messages"]
    assert "Memory ist leer" in messages[1]["content"]
