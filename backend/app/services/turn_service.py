"""Turn orchestration business logic."""

from __future__ import annotations

import uuid
from typing import Literal, cast

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim import Claim
from app.models.conflict import ConflictGroup, ConflictGroupClaim
from app.models.conversation import Conversation
from app.schemas import (
    ApprovalClass,
    ApprovalRequest,
    AuditEventType,
    AuditResult,
    AuthorityLevel,
    ClaimData,
    HandlingPolicy,
    Lifecycle,
    ProposalData,
    Sensitivity,
    SensitivityFilterInput,
    SourceType,
    TaintActionCheck,
    TaintChunk,
    TaintContext,
    TaintSummary,
    TrustLevel,
    VerificationState,
    WriteGateInput,
)
from app.schemas.api_models import ClaimProcessResult, TurnRequest, TurnResult
from app.services import rust_bridge
from app.services.audit_service import AuditService
from app.services.circuit_breaker_service import CircuitBreakerService
from app.services.claim_service import ClaimService
from app.services.conversation_service import ConversationService
from app.services.errors import LiveWebPermissionRequiredError, ServiceError
from app.services.live_web_service import (
    LiveWebContext,
    LiveWebService,
    format_live_web_context_block,
)
from app.services.llm.base import LLMMessage
from app.services.llm.claim_extractor import ClaimExtractor
from app.services.llm.context_assembler import ContextAssembler
from app.services.llm.router import get_llm_router
from app.services.llm.sensitivity_classifier import (
    classify_sensitivity,
    normalize_classification,
)
from app.services.llm.system_prompt import build_system_prompt
from app.services.proposal_service import ProposalService
from app.services.settings_service import SettingsService
from app.services.utils import normalize_user_id


class TurnService:
    """Business layer for processing incoming turns."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.audit = AuditService(db)
        self.claim_service = ClaimService(db)
        self.proposal_service = ProposalService(db)
        self.circuit_breaker = CircuitBreakerService(db)
        self.conversation_service = ConversationService(db)
        self.llm_router = get_llm_router()
        self.claim_extractor = ClaimExtractor(self.llm_router)
        self.live_web_service = LiveWebService(router=self.llm_router)

    async def process_turn(self, *, user_id: str, payload: TurnRequest) -> TurnResult:
        """Run full turn pipeline with write gates, taint checks and auditing."""
        turn_id = str(uuid.uuid4())
        action_type = "turn_process"
        channel = payload.channel
        try:
            settings = await SettingsService(self.db).get_or_create(user_id)
            if settings.kill_switch:
                raise ServiceError("Kill switch is active — all operations blocked")

            await self.circuit_breaker.check(user_id=user_id, action_type=action_type)

            classification = normalize_classification(
                await classify_sensitivity(payload.text, payload.channel)
            )
            payload_sensitivity = classification.sensitivity
            enforce_local = payload_sensitivity is Sensitivity.S4 or (
                payload_sensitivity is Sensitivity.S3 and not payload.allow_s3_cloud_fallback
            )
            preferred_provider = payload.provider or settings.preferred_provider
            preferred_model = payload.model or settings.preferred_model
            preferred_local_provider = getattr(settings, "preferred_local_provider", None)
            preferred_local_model = getattr(settings, "preferred_local_model", None)
            system_prompt = build_system_prompt(
                {
                    "name": getattr(settings, "owner_name", ""),
                    "profile": getattr(settings, "owner_profile", ""),
                    "language": getattr(settings, "owner_language", "Deutsch"),
                }
            )
            if (
                enforce_local
                and preferred_provider
                and preferred_provider not in {"ollama", "lmstudio"}
            ):
                # Security policy: S3/S4 must remain local.
                preferred_provider = None
                preferred_model = None
            if (
                enforce_local
                and preferred_local_provider
                and preferred_local_provider not in {"ollama", "lmstudio"}
            ):
                preferred_local_provider = None
                preferred_local_model = None

            api_keys = {
                "openai": getattr(settings, "openai_api_key", None),
                "deepseek": getattr(settings, "deepseek_api_key", None),
                "gemini": getattr(settings, "gemini_api_key", None),
                "mistral": getattr(settings, "mistral_api_key", None),
                "anthropic": getattr(settings, "anthropic_api_key", None),
            }

            # Chat turns (no claim override) run against a persisted conversation.
            is_chat_turn = payload.claims is None
            conversation = None
            if is_chat_turn and payload.conversation_id:
                conversation = await self.conversation_service.get_conversation(
                    conversation_id=payload.conversation_id,
                    user_id=user_id,
                )

            live_web_requested = payload.use_live_web
            if live_web_requested is None:
                live_web_requested = bool(getattr(settings, "live_web_enabled", False))
            live_web_mode = getattr(settings, "live_web_mode", "provider_native_first")
            if live_web_mode not in {"provider_native_first", "connector_only", "off"}:
                live_web_mode = "provider_native_first"
            live_web_result: LiveWebContext | None = None
            live_web_error: str | None = None
            if live_web_requested and live_web_mode != "off":
                if payload_sensitivity is Sensitivity.S4:
                    live_web_error = "live_web_blocked_for_s4"
                elif payload_sensitivity is Sensitivity.S3:
                    allow_s3_live_web = payload.allow_s3_live_web or bool(
                        getattr(settings, "live_web_s3_confirmed_default", False)
                    )
                    if not allow_s3_live_web:
                        raise LiveWebPermissionRequiredError(
                            sensitivity=payload_sensitivity.value,
                            detail=(
                                "S3-Inhalt erkannt. Bitte Live-Web-Zugriff fuer diese Nachricht "
                                "explizit bestaetigen."
                            ),
                        )
                if payload_sensitivity in {
                    Sensitivity.S0,
                    Sensitivity.S1,
                    Sensitivity.S2,
                    Sensitivity.S3,
                }:
                    try:
                        live_web_result = await self.live_web_service.search(
                            query=payload.text,
                            mode=cast(
                                Literal["provider_native_first", "connector_only", "off"],
                                live_web_mode,
                            ),
                            preferred_provider=preferred_provider,
                            api_keys=api_keys,
                        )
                    except ServiceError as exc:
                        live_web_error = str(exc)

            (
                extracted_claims,
                provider_used,
                model_used,
                response_text,
                reasoning_content,
            ) = await self._extract_claims(
                payload,
                user_id=user_id,
                sensitivity=payload_sensitivity,
                enforce_local=enforce_local,
                turn_id=turn_id,
                conversation=conversation,
                live_web_context_block=(
                    format_live_web_context_block(live_web_result) if live_web_result else None
                ),
                preferred_provider=preferred_provider,
                preferred_model=preferred_model,
                preferred_local_provider=preferred_local_provider,
                preferred_local_model=preferred_local_model,
                system_prompt=system_prompt,
                api_keys=api_keys,
            )
            sensitivity_output = rust_bridge.filter_claims(
                SensitivityFilterInput(
                    claims=extracted_claims,
                    intent_type="general_turn",
                    provider_is_local=_provider_is_local(provider_used),
                    provider_is_encrypted=_provider_is_encrypted(provider_used),
                    allow_s3_cloud_fallback=payload.allow_s3_cloud_fallback,
                )
            )
            if not extracted_claims:
                taint_summary = TaintSummary(
                    effective_trust=TrustLevel.T3,
                    effective_sensitivity=Sensitivity.S0,
                    is_tainted=False,
                    taint_sources=[],
                )
            else:
                taint_summary = rust_bridge.compute_taint(
                    TaintContext(
                        chunks=[_claim_to_taint_chunk(claim) for claim in extracted_claims]
                    )
                )

            results: list[ClaimProcessResult] = []
            for claim in sensitivity_output.allowed:
                claim_ref = _claim_ref(claim)
                proposal = ProposalData(
                    proposed_claim=claim,
                    source_ref=claim.source_ref or turn_id,
                    source_type=claim.source_type,
                )

                g1_result = rust_bridge.validate_schema(WriteGateInput(proposal=proposal))
                if not (isinstance(g1_result, str) and g1_result == "SchemaValid"):
                    results.append(
                        ClaimProcessResult(
                            claim_ref=claim_ref,
                            status="rejected",
                            reason=f"Schema validation failed: {g1_result!r}",
                        )
                    )
                    continue

                g2_result = rust_bridge.check_provenance(proposal)
                effective_claim = claim
                if g2_result.locked_to_tentative:
                    effective_claim = claim.model_copy(
                        update={"verification_state": VerificationState.tentative}
                    )
                    proposal = ProposalData(
                        proposed_claim=effective_claim,
                        source_ref=proposal.source_ref,
                        source_type=proposal.source_type,
                    )

                existing_models = await self.claim_service.list_claims(
                    user_id=user_id,
                    subject=effective_claim.subject,
                )
                existing_claims = [_claim_model_to_data(item) for item in existing_models]
                g3_result = rust_bridge.detect_conflicts(proposal, existing_claims)
                conflict_result = _normalize_union(g3_result.result)

                approval_decision = _normalize_union(
                    rust_bridge.resolve_approval(
                        ApprovalRequest(
                            action_type="memory_write",
                            approval_class=ApprovalClass.class2,
                            payload_preview=effective_claim.content[:200],
                            authority_level=AuthorityLevel.A1,
                            payload_sensitivity=effective_claim.sensitivity,
                        )
                    )
                )
                taint_decision = _normalize_union(
                    rust_bridge.check_tainted_action(
                        TaintActionCheck(
                            taint_summary=taint_summary,
                            proposed_class=ApprovalClass.class2,
                        )
                    )
                )

                if isinstance(taint_decision, dict) and "Block" in taint_decision:
                    block_detail = cast(dict[str, str], taint_decision["Block"])
                    results.append(
                        ClaimProcessResult(
                            claim_ref=claim_ref,
                            status="rejected",
                            reason=block_detail["reason"],
                        )
                    )
                    continue
                if isinstance(approval_decision, dict) and "Denied" in approval_decision:
                    denied_detail = cast(dict[str, str], approval_decision["Denied"])
                    results.append(
                        ClaimProcessResult(
                            claim_ref=claim_ref,
                            status="rejected",
                            reason=denied_detail["reason"],
                        )
                    )
                    continue

                conflict_group_id: str | None = None
                if isinstance(conflict_result, dict) and "ConflictGroup" in conflict_result:
                    conflict_payload = cast(
                        dict[str, list[str]],
                        conflict_result["ConflictGroup"],
                    )
                    claim_ids = list(
                        dict.fromkeys(uuid.UUID(value) for value in conflict_payload["claim_ids"])
                    )
                    group_id = uuid.uuid4()
                    conflict_group = ConflictGroup(
                        group_id=group_id,
                        user_id=normalize_user_id(user_id),
                        status="pending",
                    )
                    self.db.add(conflict_group)
                    for claim_id in claim_ids:
                        self.db.add(
                            ConflictGroupClaim(
                                group_id=group_id,
                                claim_id=claim_id,
                            )
                        )
                    await self.db.commit()
                    conflict_group_id = str(group_id)

                requires_hitl = (
                    conflict_group_id is not None
                    or not g2_result.auto_confirm_eligible
                    or (isinstance(approval_decision, dict) and "EscalatedTo" in approval_decision)
                    or (isinstance(taint_decision, dict) and "Escalate" in taint_decision)
                )

                if requires_hitl:
                    proposal_model = await self.proposal_service.create_proposal(
                        user_id=user_id,
                        proposal=proposal,
                        conflict_group_id=conflict_group_id,
                    )
                    results.append(
                        ClaimProcessResult(
                            claim_ref=claim_ref,
                            status="proposal_created",
                            proposal_id=str(proposal_model.proposal_id),
                            reason="human_review_required",
                        )
                    )
                else:
                    created_claim = await self.claim_service.create_claim_from_proposal(
                        user_id=user_id,
                        claim_data=proposal.proposed_claim,
                        source_ref=proposal.source_ref,
                        source_type=proposal.source_type,
                        changed_by="turn_pipeline",
                    )
                    results.append(
                        ClaimProcessResult(
                            claim_ref=claim_ref,
                            status="created",
                            claim_id=str(created_claim.claim_id),
                        )
                    )

            if sensitivity_output.filtered_count:
                for filtered_index in range(sensitivity_output.filtered_count):
                    results.append(
                        ClaimProcessResult(
                            claim_ref=f"filtered-{filtered_index}",
                            status="filtered_out",
                            reason="sensitivity_filter",
                        )
                    )

            if is_chat_turn:
                if conversation is None:
                    conversation = await self.conversation_service.create_conversation(
                        user_id=user_id,
                        title=payload.text,
                    )
                await self.conversation_service.append_message(
                    conversation=conversation,
                    user_id=user_id,
                    role="user",
                    content=payload.text,
                    sensitivity=payload_sensitivity,
                    turn_id=turn_id,
                )
                if response_text:
                    await self.conversation_service.append_message(
                        conversation=conversation,
                        user_id=user_id,
                        role="assistant",
                        content=response_text,
                        sensitivity=payload_sensitivity,
                        provider=provider_used,
                        model=model_used,
                        turn_id=turn_id,
                    )
            conversation_id = (
                str(conversation.conversation_id)
                if conversation is not None and conversation.conversation_id is not None
                else None
            )

            result_payload = TurnResult(
                turn_id=turn_id,
                response_text=response_text,
                reasoning_content=reasoning_content,
                provider=provider_used,
                model=model_used,
                claims_processed=len(sensitivity_output.allowed),
                filtered_count=sensitivity_output.filtered_count,
                results=results,
                taint_summary=taint_summary,
                conversation_id=conversation_id,
            )

            await self.circuit_breaker.increment(user_id=user_id, action_type=action_type)
            audit_payload = result_payload.model_dump(mode="json")
            audit_payload["provider"] = provider_used
            audit_payload["classifier_source"] = classification.source
            audit_payload["local_classifier_available"] = classification.local_classifier_available
            audit_payload["live_web_requested"] = live_web_requested
            audit_payload["live_web_mode"] = live_web_mode
            audit_payload["live_web_strategy"] = (
                live_web_result.strategy if live_web_result else "none"
            )
            audit_payload["live_web_sources"] = (
                [{"title": item.title, "url": item.url} for item in live_web_result.sources]
                if live_web_result
                else []
            )
            if live_web_error is not None:
                audit_payload["live_web_error"] = live_web_error
            await self.audit.log(
                event_type=AuditEventType.turn_processed,
                result=AuditResult.success,
                user_id=user_id,
                channel=channel,
                actor="service:turn_service",
                target_id=turn_id,
                detail="Turn processed",
                payload=audit_payload,
                source_ref=turn_id,
                sensitivity=taint_summary.effective_sensitivity,
            )
            return result_payload
        except Exception as exc:
            await self.audit.log(
                event_type=AuditEventType.turn_processed,
                result=AuditResult.failed,
                user_id=user_id,
                channel=channel,
                actor="service:turn_service",
                target_id=turn_id,
                detail="Turn processing failed",
                payload={"error": str(exc)},
                source_ref=turn_id,
                sensitivity=Sensitivity.S0,
            )
            raise

    async def _extract_claims(
        self,
        payload: TurnRequest,
        *,
        user_id: str,
        sensitivity: Sensitivity,
        enforce_local: bool,
        turn_id: str,
        conversation: Conversation | None = None,
        live_web_context_block: str | None = None,
        preferred_provider: str | None = None,
        preferred_model: str | None = None,
        preferred_local_provider: str | None = None,
        preferred_local_model: str | None = None,
        system_prompt: str = "",
        api_keys: dict[str, str | None] | None = None,
    ) -> tuple[list[ClaimData], str, str, str | None, str | None]:
        """Extract claims from override or from routed LLM calls."""
        if payload.claims is None:
            provider_is_local = (
                enforce_local and sensitivity in {Sensitivity.S3, Sensitivity.S4}
            ) or (preferred_provider is not None and preferred_provider in {"ollama", "lmstudio"})
            context_block = await ContextAssembler(self.db).assemble(
                user_id=user_id,
                sensitivity=sensitivity,
                provider_is_local=provider_is_local,
            )
            history: list[LLMMessage] = []
            if conversation is not None:
                recent = await self.conversation_service.recent_history(
                    conversation=conversation,
                    provider_is_local=provider_is_local,
                )
                history = [
                    {
                        "role": "user" if item.role == "user" else "assistant",
                        "content": item.content,
                    }
                    for item in recent
                ]
            messages: list[LLMMessage] = [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "system",
                    "content": context_block,
                },
                *history,
                {"role": "user", "content": payload.text},
            ]
            if live_web_context_block:
                messages.insert(
                    2,
                    {
                        "role": "system",
                        "content": live_web_context_block,
                    },
                )
            llm_response = await self.llm_router.route(
                intent="general_turn",
                sensitivity=sensitivity,
                enforce_local=enforce_local,
                messages=messages,
                preferred_provider=preferred_provider,
                preferred_model=preferred_model,
                preferred_local_provider=preferred_local_provider,
                preferred_local_model=preferred_local_model,
                api_keys=api_keys,
            )
            claims = await self.claim_extractor.extract(
                llm_response_text=llm_response.content,
                original_message=payload.text,
                sensitivity=sensitivity,
                turn_id=turn_id,
                api_keys=api_keys,
            )
            return (
                claims,
                llm_response.provider,
                llm_response.model,
                llm_response.content,
                llm_response.reasoning_content,
            )
        return payload.claims, "override", payload.model or "override", None, None


def _claim_ref(claim: ClaimData) -> str:
    return f"{claim.subject}:{claim.attribute or '_'}:{claim.value}"


def _claim_to_taint_chunk(claim: ClaimData) -> TaintChunk:
    return TaintChunk(
        chunk_id=_claim_ref(claim),
        trust_level=claim.trust_level,
        sensitivity=claim.sensitivity,
        source_type=claim.source_type,
    )


def _claim_model_to_data(claim: Claim) -> ClaimData:
    return ClaimData(
        subject=claim.subject,
        attribute=claim.attribute,
        value=claim.value,
        content=claim.content,
        memory_type=claim.memory_type,
        sensitivity=Sensitivity(claim.sensitivity),
        trust_level=TrustLevel(claim.trust_level),
        handling_policy=HandlingPolicy(claim.handling_policy),
        verification_state=VerificationState(claim.verification_state),
        confidence=claim.confidence,
        source_type=SourceType(claim.source_type),
        source_ref=claim.source_ref,
        user_locked=claim.user_locked,
        decay_eligible=claim.decay_eligible,
        lifecycle=Lifecycle(claim.lifecycle),
        valid_from=claim.valid_from.isoformat() if claim.valid_from else None,
        valid_to=claim.valid_to.isoformat() if claim.valid_to else None,
    )


def _normalize_union(value: object) -> str | dict[str, object]:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        dumped = value.model_dump()
        if isinstance(dumped, dict):
            return dumped
    return {"Unknown": {"value": str(value)}}


def _provider_is_local(provider_name: str) -> bool:
    return provider_name in {"ollama", "lmstudio", "override"}


def _provider_is_encrypted(provider_name: str) -> bool:
    return provider_name not in {"ollama", "lmstudio"}
