"""Memory v2 endpoints: lanes, recall, graph, behavioral rules, provenance."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db, get_redis
from app.memory.lanes import AuthorityClass
from app.models.memory import (
    BehavioralRule,
    BehavioralRuleConflict,
    MemoryEntity,
    MemoryEntityRelation,
    RecallSnippet,
)
from app.schemas.memory import (
    ApproveRuleRequest,
    EntityRequest,
    EntityResponse,
    MemoryStatsResponse,
    ProposeRuleRequest,
    ProposeRuleResponse,
    ProvenanceEventResponse,
    RecallResponse,
    RejectRuleRequest,
    RelationRequest,
    RelationResponse,
    RuleConflictResponse,
    RuleResponse,
    SnippetRequest,
    SnippetResponse,
    WriteFactRequest,
    WriteFactResponse,
)
from app.services.behavioral_rule_service import BehavioralRuleService
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.memory_graph_service import MemoryGraphService
from app.services.memory_provenance_service import MemoryProvenanceService
from app.services.memory_recall_service import MemoryRecallService
from app.services.memory_write_service import MemoryWriteService

router = APIRouter(tags=["memory"])


@router.post("/facts", response_model=WriteFactResponse)
async def write_fact(
    payload: WriteFactRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> WriteFactResponse:
    service = MemoryWriteService(db, redis)
    lane = _parse_lane(payload.lane)
    result = await service.write_fact(
        user_id=user_id,
        claim_data=payload.claim,
        session_id=payload.session_id,
        lane=lane,
    )
    return WriteFactResponse(
        status=result.status,
        lane=result.lane,
        claim_id=result.claim_id,
        reason=result.reason,
        rebound_active=result.rebound_active,
        conflict=result.conflict,
    )


@router.get("/recall", response_model=RecallResponse)
async def recall(
    query: str = Query(..., min_length=1),
    provider_is_local: bool = Query(default=True),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecallResponse:
    service = MemoryRecallService(db)
    result = await service.recall(user_id=user_id, query=query, provider_is_local=provider_is_local)
    return RecallResponse(
        text=result.text,
        identity=[c.content for c in result.identity],
        relevant=[s.candidate.content for s in result.relevant],
        related=result.related_edges,
        rules=result.rules,
    )


@router.post("/snippets", status_code=status.HTTP_201_CREATED, response_model=SnippetResponse)
async def add_snippet(
    payload: SnippetRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SnippetResponse:
    service = MemoryGraphService(db)
    snippet = await service.add_snippet(
        user_id=user_id,
        role=payload.role,
        content=payload.content,
        session_id=payload.session_id,
    )
    return _snippet_response(snippet)


@router.get("/snippets", response_model=list[SnippetResponse])
async def list_snippets(
    session_id: str | None = Query(default=None),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SnippetResponse]:
    service = MemoryGraphService(db)
    snippets = await service.list_snippets(user_id=user_id, session_id=session_id)
    return [_snippet_response(item) for item in snippets]


@router.post("/entities", status_code=status.HTTP_201_CREATED, response_model=EntityResponse)
async def upsert_entity(
    payload: EntityRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EntityResponse:
    service = MemoryGraphService(db)
    entity = await service.upsert_entity(
        user_id=user_id,
        name=payload.name,
        entity_type=payload.entity_type,
        attributes=payload.attributes,
    )
    return _entity_response(entity)


@router.get("/entities", response_model=list[EntityResponse])
async def list_entities(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EntityResponse]:
    service = MemoryGraphService(db)
    entities = await service.list_entities(user_id=user_id)
    return [_entity_response(item) for item in entities]


@router.post("/relations", status_code=status.HTTP_201_CREATED, response_model=RelationResponse)
async def add_relation(
    payload: RelationRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RelationResponse:
    service = MemoryGraphService(db)
    try:
        relation = await service.add_relation(
            user_id=user_id,
            subject_id=payload.subject_id,
            predicate=payload.predicate,
            object_id=payload.object_id,
            confidence=payload.confidence,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _relation_response(relation)


@router.get("/relations", response_model=list[RelationResponse])
async def list_relations(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RelationResponse]:
    service = MemoryGraphService(db)
    relations = await service.list_relations(user_id=user_id)
    return [_relation_response(item) for item in relations]


@router.get("/rules", response_model=list[RuleResponse])
async def list_rules(
    status_filter: str | None = Query(default=None, alias="status"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RuleResponse]:
    service = BehavioralRuleService(db)
    rules = await service.list_rules(user_id=user_id, status=status_filter)
    return [_rule_response(item) for item in rules]


@router.post("/rules", status_code=status.HTTP_201_CREATED, response_model=ProposeRuleResponse)
async def propose_rule(
    payload: ProposeRuleRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProposeRuleResponse:
    service = BehavioralRuleService(db)
    try:
        outcome = await service.propose_rule(
            user_id=user_id,
            behavior_text=payload.behavior_text,
            domain=payload.domain,
            trigger=payload.trigger,
            effect=payload.effect,
            artifact_cost=payload.artifact_cost,
            source_type=payload.source_type,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ProposeRuleResponse(
        rule=_rule_response(outcome.rule),
        conflicts=[_conflict_response(c) for c in outcome.conflicts],
        has_hard_conflict=outcome.has_hard_conflict,
    )


@router.post("/rules/{rule_id}/approve", response_model=RuleResponse)
async def approve_rule(
    rule_id: str,
    payload: ApproveRuleRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    service = BehavioralRuleService(db)
    try:
        rule = await service.approve_rule(
            rule_id=rule_id,
            user_id=user_id,
            decided_by=user_id,
            override_soft=payload.override_soft,
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _rule_response(rule)


@router.post("/rules/{rule_id}/reject", response_model=RuleResponse)
async def reject_rule(
    rule_id: str,
    payload: RejectRuleRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    service = BehavioralRuleService(db)
    try:
        rule = await service.reject_rule(
            rule_id=rule_id, user_id=user_id, decided_by=user_id, reason=payload.reason
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _rule_response(rule)


@router.post("/rules/{rule_id}/retire", response_model=RuleResponse)
async def retire_rule(
    rule_id: str,
    payload: RejectRuleRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    service = BehavioralRuleService(db)
    try:
        rule = await service.retire_rule(
            rule_id=rule_id, user_id=user_id, decided_by=user_id, reason=payload.reason
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _rule_response(rule)


@router.get("/rules/conflicts", response_model=list[RuleConflictResponse])
async def list_rule_conflicts(
    rule_id: str | None = Query(default=None),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RuleConflictResponse]:
    service = BehavioralRuleService(db)
    conflicts = await service.list_conflicts(user_id=user_id, rule_id=rule_id)
    return [_conflict_response(item) for item in conflicts]


@router.get("/provenance/{target_id}", response_model=list[ProvenanceEventResponse])
async def get_provenance(
    target_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProvenanceEventResponse]:
    service = MemoryProvenanceService(db)
    events = await service.get_provenance(user_id=user_id, target_id=target_id)
    return [
        ProvenanceEventResponse(
            event_type=event.event_type,
            result=event.result,
            actor=event.actor,
            detail=event.detail,
            timestamp=event.timestamp,
        )
        for event in events
    ]


@router.get("/stats", response_model=MemoryStatsResponse)
async def memory_stats(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MemoryStatsResponse:
    service = MemoryProvenanceService(db)
    stats = await service.memory_stats(user_id=user_id)
    return MemoryStatsResponse(**stats)


@router.get("/snapshot")
async def snapshot(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    service = MemoryProvenanceService(db)
    return await service.snapshot(user_id=user_id)


def _parse_lane(value: str | None) -> AuthorityClass | None:
    if value is None:
        return None
    try:
        return AuthorityClass(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown lane: {value}"
        ) from exc


def _snippet_response(snippet: RecallSnippet) -> SnippetResponse:
    return SnippetResponse(
        snippet_id=str(snippet.snippet_id),
        role=snippet.role,
        content=snippet.content,
        session_id=snippet.session_id,
        created_at=snippet.created_at,
        expires_at=snippet.expires_at,
    )


def _entity_response(entity: MemoryEntity) -> EntityResponse:
    return EntityResponse(
        entity_id=str(entity.entity_id),
        name=entity.name,
        entity_type=entity.entity_type,
        attributes=entity.attributes,
    )


def _relation_response(relation: MemoryEntityRelation) -> RelationResponse:
    return RelationResponse(
        relation_id=str(relation.relation_id),
        subject_id=str(relation.subject_id),
        predicate=relation.predicate,
        object_id=str(relation.object_id),
        confidence=relation.confidence,
    )


def _rule_response(rule: BehavioralRule) -> RuleResponse:
    return RuleResponse(
        rule_id=str(rule.rule_id),
        domain=rule.domain,
        behavior_text=rule.behavior_text,
        trigger=rule.trigger_json or {},
        effect=rule.effect_json or {},
        artifact_cost=rule.artifact_cost,
        status=rule.status,
        source_type=rule.source_type,
        previous_rule_id=str(rule.previous_rule_id) if rule.previous_rule_id else None,
        created_at=rule.created_at,
        activated_at=rule.activated_at,
        expires_at=rule.expires_at,
    )


def _conflict_response(conflict: BehavioralRuleConflict) -> RuleConflictResponse:
    return RuleConflictResponse(
        conflict_id=str(conflict.conflict_id),
        rule_id=str(conflict.rule_id),
        other_rule_id=str(conflict.other_rule_id) if conflict.other_rule_id else None,
        conflict_type=conflict.conflict_type,
        severity=conflict.severity,
        detail=conflict.detail,
        resolved=conflict.resolved,
    )
