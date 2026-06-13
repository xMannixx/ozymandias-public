"""Provenance, snapshots/restore and memory statistics.

Provenance is reconstructed read-only from the append-only audit log. Snapshots
export the user's structured memory for recovery; restore re-materializes the
v2 tables. Stats surface lane distribution, open conflicts and graph size.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.memory import provenance
from app.models.claim import Claim
from app.models.memory import (
    BehavioralRule,
    BehavioralRuleConflict,
    MemoryEntity,
    MemoryEntityRelation,
    RecallSnippet,
)
from app.schemas import VerificationState
from app.services.audit_service import AuditService
from app.services.utils import normalize_user_id

_PROVENANCE_SCAN_LIMIT = 2000


class MemoryProvenanceService:
    """Read-only provenance, plus snapshot/restore and memory stats."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.audit = AuditService(db)

    async def get_provenance(
        self, *, user_id: str, target_id: str
    ) -> list[provenance.ProvenanceEvent]:
        """Reconstruct the audit chain that references one claim/rule id."""
        entries, _total = await self.audit.list_entries(
            user_id=user_id,
            event_type=None,
            sensitivity=None,
            result=None,
            after=None,
            before=None,
            limit=_PROVENANCE_SCAN_LIMIT,
            offset=0,
            exclude_s4=False,
        )
        events = [
            {
                "event_type": entry.event_type,
                "result": entry.result or "",
                "payload": entry.payload,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
            }
            for entry in entries
        ]
        return provenance.reconstruct(events, target_id=target_id)

    async def memory_stats(self, *, user_id: str) -> dict[str, Any]:
        """Lane distribution, open conflicts and graph/recall counts."""
        uid = normalize_user_id(user_id)
        lane_rows = await self.db.execute(
            select(Claim.authority_class, func.count())
            .where(
                Claim.user_id == uid,
                Claim.verification_state.notin_(
                    [
                        VerificationState.superseded.value,
                        VerificationState.retracted.value,
                    ]
                ),
            )
            .group_by(Claim.authority_class)
        )
        claims_by_lane = {str(lane): int(count) for lane, count in lane_rows.all()}

        return {
            "claims_by_lane": claims_by_lane,
            "open_conflicts": await self._count(
                BehavioralRuleConflict,
                uid,
                BehavioralRuleConflict.resolved.is_(False),
            ),
            "entities": await self._count(MemoryEntity, uid),
            "relations": await self._count(MemoryEntityRelation, uid),
            "snippets": await self._count(RecallSnippet, uid),
            "behavioral_rules_active": await self._count(
                BehavioralRule, uid, BehavioralRule.status == "active"
            ),
            "behavioral_rules_pending": await self._count(
                BehavioralRule, uid, BehavioralRule.status == "pending"
            ),
        }

    async def snapshot(self, *, user_id: str) -> dict[str, Any]:
        """Export structured memory for recovery."""
        uid = normalize_user_id(user_id)
        claims = await self._all(Claim, uid)
        entities = await self._all(MemoryEntity, uid)
        relations = await self._all(MemoryEntityRelation, uid)
        rules = await self._all(BehavioralRule, uid)
        names = {e.entity_id: e.name for e in entities}
        return {
            "version": 1,
            "created_at": datetime.now(tz=UTC).isoformat(),
            "user_id": str(uid),
            "claims": [_claim_to_dict(c) for c in claims],
            "entities": [_entity_to_dict(e) for e in entities],
            "relations": [_relation_to_dict(r, names) for r in relations],
            "behavioral_rules": [_rule_to_dict(r) for r in rules],
        }

    async def restore_entities(self, *, user_id: str, snapshot: dict[str, Any]) -> dict[str, int]:
        """Re-materialize entity/relation graph from a snapshot (additive).

        Claims and rules are intentionally not auto-restored to avoid silently
        reactivating behavior; the graph is safe to rebuild.
        """
        uid = normalize_user_id(user_id)
        name_to_id: dict[str, uuid.UUID] = {}
        restored_entities = 0
        for item in snapshot.get("entities", []):
            existing = await self.db.execute(
                select(MemoryEntity).where(
                    MemoryEntity.user_id == uid, MemoryEntity.name == item["name"]
                )
            )
            found = existing.scalar_one_or_none()
            if found is not None:
                name_to_id[item["name"]] = found.entity_id
                continue
            entity = MemoryEntity(
                user_id=uid,
                name=item["name"],
                entity_type=item.get("entity_type"),
                attributes=item.get("attributes"),
            )
            self.db.add(entity)
            await self.db.flush()
            name_to_id[item["name"]] = entity.entity_id
            restored_entities += 1

        restored_relations = 0
        for rel in snapshot.get("relations", []):
            subject_id = name_to_id.get(rel.get("subject_name"))
            object_id = name_to_id.get(rel.get("object_name"))
            if subject_id is None or object_id is None:
                continue
            self.db.add(
                MemoryEntityRelation(
                    user_id=uid,
                    subject_id=subject_id,
                    predicate=rel["predicate"],
                    object_id=object_id,
                    confidence=rel.get("confidence", 0.5),
                )
            )
            restored_relations += 1
        await self.db.commit()
        return {"entities": restored_entities, "relations": restored_relations}

    async def _count(self, model: Any, uid: uuid.UUID, *conditions: Any) -> int:
        stmt = select(func.count()).select_from(model).where(model.user_id == uid, *conditions)
        result = await self.db.execute(stmt)
        raw = result.scalar_one_or_none()
        return int(raw) if raw is not None else 0

    async def _all(self, model: Any, uid: uuid.UUID) -> list[Any]:
        result: Any = await self.db.execute(select(model).where(model.user_id == uid))
        return list(result.scalars().all())


def _claim_to_dict(claim: Claim) -> dict[str, Any]:
    return {
        "subject": claim.subject,
        "attribute": claim.attribute,
        "value": claim.value,
        "content": claim.content,
        "memory_type": claim.memory_type,
        "authority_class": claim.authority_class,
        "verification_state": claim.verification_state,
        "confidence": claim.confidence,
        "sensitivity": claim.sensitivity,
        "source_type": claim.source_type,
    }


def _entity_to_dict(entity: MemoryEntity) -> dict[str, Any]:
    return {
        "name": entity.name,
        "entity_type": entity.entity_type,
        "attributes": entity.attributes,
    }


def _relation_to_dict(
    relation: MemoryEntityRelation, names: dict[uuid.UUID, str]
) -> dict[str, Any]:
    return {
        "subject_name": names.get(relation.subject_id),
        "object_name": names.get(relation.object_id),
        "predicate": relation.predicate,
        "confidence": relation.confidence,
    }


def _rule_to_dict(rule: BehavioralRule) -> dict[str, Any]:
    return {
        "domain": rule.domain,
        "behavior_text": rule.behavior_text,
        "trigger_json": rule.trigger_json,
        "effect_json": rule.effect_json,
        "status": rule.status,
        "artifact_cost": rule.artifact_cost,
    }
