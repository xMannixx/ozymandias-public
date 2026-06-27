"""Memory v2: authority lanes, snippets, entity graph and behavioral rules.

Revision ID: 0001_memory_v2
Revises:
Create Date: 2026-06-02
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0001_memory_v2"
down_revision = None
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    inspector = sa.inspect(op.get_bind())
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _ensure_claims_table() -> None:
    if _has_table("claims"):
        return
    op.create_table(
        "claims",
        sa.Column(
            "claim_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("attribute", sa.Text()),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("memory_type", sa.Text(), nullable=False),
        sa.Column(
            "verification_state",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'tentative'"),
        ),
        sa.Column("confidence", sa.Float(), nullable=False, server_default=sa.text("0.5")),
        sa.Column("source_ref", sa.Text()),
        sa.Column("source_type", sa.Text(), nullable=False),
        sa.Column(
            "sensitivity",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'S0'"),
        ),
        sa.Column(
            "trust_level",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'T3'"),
        ),
        sa.Column(
            "handling_policy",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'cloud_ok_encrypted'"),
        ),
        sa.Column(
            "user_locked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "decay_eligible",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "lifecycle",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'permanent'"),
        ),
        sa.Column("valid_from", sa.DateTime(timezone=True)),
        sa.Column("valid_to", sa.DateTime(timezone=True)),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("superseded_at", sa.DateTime(timezone=True)),
        sa.Column(
            "review_due",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("last_reviewed", sa.DateTime(timezone=True)),
        sa.Column("last_accessed", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("idx_claims_sensitivity", "claims", ["user_id", "sensitivity"])
    op.create_index("idx_claims_verification", "claims", ["user_id", "verification_state"])


def upgrade() -> None:
    _ensure_claims_table()
    if not _has_column("claims", "authority_class"):
        op.add_column(
            "claims",
            sa.Column(
                "authority_class",
                sa.Text(),
                nullable=False,
                server_default=sa.text("'evidence'"),
            ),
        )
    if not _has_index("claims", "idx_claims_authority"):
        op.create_index("idx_claims_authority", "claims", ["user_id", "authority_class"])

    op.create_table(
        "recall_snippets",
        sa.Column(
            "snippet_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", sa.Text()),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_snippets_user_session", "recall_snippets", ["user_id", "session_id"])
    op.create_index("idx_snippets_expires", "recall_snippets", ["expires_at"])

    op.create_table(
        "memory_entities",
        sa.Column(
            "entity_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.Text()),
        sa.Column("attributes", postgresql.JSONB()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("user_id", "name", name="uq_entities_user_name"),
    )
    op.create_index("idx_entities_user", "memory_entities", ["user_id"])
    op.create_index("idx_entities_expires", "memory_entities", ["expires_at"])

    op.create_table(
        "memory_entity_relations",
        sa.Column(
            "relation_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "subject_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("memory_entities.entity_id"),
            nullable=False,
        ),
        sa.Column("predicate", sa.Text(), nullable=False),
        sa.Column(
            "object_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("memory_entities.entity_id"),
            nullable=False,
        ),
        sa.Column("confidence", sa.Float(), nullable=False, server_default=sa.text("0.5")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint(
            "user_id",
            "subject_id",
            "predicate",
            "object_id",
            name="uq_relations_triple",
        ),
    )
    op.create_index("idx_relations_subject", "memory_entity_relations", ["subject_id"])
    op.create_index("idx_relations_object", "memory_entity_relations", ["object_id"])
    op.create_index("idx_relations_expires", "memory_entity_relations", ["expires_at"])

    op.create_table(
        "behavioral_rules",
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("domain", sa.Text(), nullable=False, server_default=sa.text("'global'")),
        sa.Column("behavior_text", sa.Text(), nullable=False),
        sa.Column(
            "trigger_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "effect_json",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("artifact_cost", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("source_type", sa.Text(), nullable=False),
        sa.Column(
            "previous_rule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("behavioral_rules.rule_id"),
        ),
        sa.Column("proposed_by", sa.Text()),
        sa.Column("decided_by", sa.Text()),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("rejection_reason", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("activated_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_behavioral_rules_status", "behavioral_rules", ["user_id", "status"])
    op.create_index("idx_behavioral_rules_domain", "behavioral_rules", ["user_id", "domain"])
    op.create_index("idx_behavioral_rules_expires", "behavioral_rules", ["expires_at"])

    op.create_table(
        "behavioral_rule_conflicts",
        sa.Column(
            "conflict_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "rule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("behavioral_rules.rule_id"),
            nullable=False,
        ),
        sa.Column(
            "other_rule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("behavioral_rules.rule_id"),
        ),
        sa.Column("conflict_type", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("detail", sa.Text()),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("idx_rule_conflicts_rule", "behavioral_rule_conflicts", ["rule_id"])


def downgrade() -> None:
    op.drop_table("behavioral_rule_conflicts")
    op.drop_table("behavioral_rules")
    op.drop_table("memory_entity_relations")
    op.drop_table("memory_entities")
    op.drop_table("recall_snippets")
    op.drop_index("idx_claims_authority", table_name="claims")
    op.drop_column("claims", "authority_class")
