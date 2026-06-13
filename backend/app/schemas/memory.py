"""API request/response models for the v2 memory subsystem."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.contracts import ClaimData


class WriteFactRequest(BaseModel):
    claim: ClaimData
    session_id: str | None = None
    lane: str | None = None


class WriteFactResponse(BaseModel):
    status: str
    lane: str
    claim_id: str | None = None
    reason: str | None = None
    rebound_active: bool = False
    conflict: bool = False


class RecallResponse(BaseModel):
    text: str
    identity: list[str]
    relevant: list[str]
    related: list[str]
    rules: list[str]


class SnippetRequest(BaseModel):
    role: str
    content: str
    session_id: str | None = None


class SnippetResponse(BaseModel):
    snippet_id: str
    role: str
    content: str
    session_id: str | None
    created_at: datetime
    expires_at: datetime | None


class EntityRequest(BaseModel):
    name: str
    entity_type: str | None = None
    attributes: dict[str, Any] | None = None


class EntityResponse(BaseModel):
    entity_id: str
    name: str
    entity_type: str | None
    attributes: dict[str, Any] | None


class RelationRequest(BaseModel):
    subject_id: str
    predicate: str
    object_id: str
    confidence: float = 0.5


class RelationResponse(BaseModel):
    relation_id: str
    subject_id: str
    predicate: str
    object_id: str
    confidence: float


class ProposeRuleRequest(BaseModel):
    behavior_text: str
    domain: str = "global"
    trigger: dict[str, Any] = Field(default_factory=dict)
    effect: dict[str, Any] = Field(default_factory=dict)
    artifact_cost: int = 1
    source_type: str = "user_explicit"


class RuleConflictResponse(BaseModel):
    conflict_id: str
    rule_id: str
    other_rule_id: str | None
    conflict_type: str
    severity: str
    detail: str | None
    resolved: bool


class RuleResponse(BaseModel):
    rule_id: str
    domain: str
    behavior_text: str
    trigger: dict[str, Any]
    effect: dict[str, Any]
    artifact_cost: int
    status: str
    source_type: str
    previous_rule_id: str | None
    created_at: datetime
    activated_at: datetime | None
    expires_at: datetime | None


class ProposeRuleResponse(BaseModel):
    rule: RuleResponse
    conflicts: list[RuleConflictResponse]
    has_hard_conflict: bool


class ApproveRuleRequest(BaseModel):
    override_soft: bool = False


class RejectRuleRequest(BaseModel):
    reason: str | None = None


class ProvenanceEventResponse(BaseModel):
    event_type: str
    result: str
    actor: str
    detail: str
    timestamp: str | None


class MemoryStatsResponse(BaseModel):
    claims_by_lane: dict[str, int]
    open_conflicts: int
    entities: int
    relations: int
    snippets: int
    behavioral_rules_active: int
    behavioral_rules_pending: int
