# OZY Datenbank-Guide

> Schema-Datei: `docs/spec/OZY_DB_Schema.sql`  
> Technologie: PostgreSQL 18 + pgvector 0.8.2  
> ER-Diagramm: Nicht vorhanden (TODO)  
> Migrationen: `backend/alembic/`

---

## Überblick

Die Ozymandias-Datenbank ist in PostgreSQL mit pgvector-Extension implementiert. Sie speichert alle persistenten Daten: Memory/Claims, Gesprächsgeschichte, Audit-Trail, Projekte, Kontakte und Nutzereinstellungen.

**Design-Prinzipien:**
- Single-Owner-Architektur: `user_id` überall, vorbereitet für Multi-User
- Append-Only für sicherheitskritische Tabellen (audit_log, claim_versions)
- Tri-temporal für Claims: Weltzeit, Wissenszeit, Glaubenszeit
- pgvector für semantische Suche in Episoden

---

## Tabellen-Übersicht

| Tabelle | Kategorie | Zweck |
|---|---|---|
| `claims` | Memory | Semantisches Gedächtnis — strukturierte Fakten |
| `claim_access_log` | Memory | Zugriffs-Tracking für Relevance-Berechnung |
| `claim_versions` | Memory | Append-Only Versionshistorie jedes Claims |
| `conflict_groups` | Memory | Widersprüche zwischen Claims (G3 Detection) |
| `conflict_group_claims` | Memory | Junction Konfliktgruppe ↔ Claim (referenzielle Integrität) |
| `memory_proposals` | Memory | Proposal-Queue (G4 Human-in-the-Loop) |
| `procedural_rules` | Memory | Prozedurales Gedächtnis (Arbeitsstil, Ton) |
| `recall_snippets` | Memory v2 | Roh-Gesprächsausschnitte für wörtlichen Abruf |
| `memory_entities` / `memory_entity_relations` | Memory v2 | Entity-Relations-Graph |
| `behavioral_rules` / `behavioral_rule_conflicts` | Memory v2 | Verhaltensregeln (Procedural Lane) + Konflikte |
| `episodes` | Memory | Episodisches Gedächtnis (Gesprächsarchiv) |
| `audit_log` | Security | Lückenloses Aktionsprotokoll |
| `user_settings` | Config | Guardian/Autopilot, Provider, Decay-Parameter |
| `google_tokens` | Auth | Google OAuth Tokens für Gmail/Calendar |
| `projects` | Projekte | Projektverwaltung |
| `project_milestones` | Projekte | Meilensteine |
| `project_tasks` | Projekte | Aufgaben |
| `project_risks` | Projekte | Risiken |
| `project_notes` | Projekte | Notizen |
| `project_files` | Projekte | Datei-Referenzen (MinIO) |
| `project_links` | Projekte | Links |
| `contacts` | Kontakte | Kontaktverwaltung |
| `contact_projects` | Kontakte | Kontakt-Projekt-Verknüpfung |

---

## Memory-Tabellen (Detailliert)

### `claims` — Semantisches Gedächtnis

Die wichtigste Tabelle. Speichert strukturierte Fakten (Claims) mit vollständiger Governance-Metadata.

```sql
claims (
    claim_id UUID PK,
    user_id UUID NOT NULL,

    -- Strukturierte Felder (für Conflict Detection G3)
    subject TEXT NOT NULL,          -- "alex", "kontakt", "auto"
    attribute TEXT,                 -- "wohnort", "beruf" (null bei subjektiven Claims)
    value TEXT NOT NULL,            -- "Beispielstadt", "softwareentwicklung"

    -- Inhalt
    content TEXT NOT NULL,          -- Menschenlesbare Beschreibung
    memory_type TEXT NOT NULL,      -- "profile", "health", "preference", ...

    -- Governance
    verification_state TEXT,        -- tentative | confirmed | superseded | retracted
    confidence FLOAT,               -- 0.0–1.0
    source_ref TEXT,                -- Episode-ID, Turn-ID, Batch-Job-ID
    source_type TEXT,               -- user_explicit | model_inferred | connector_data

    -- Security & Privacy
    sensitivity TEXT,               -- S0 | S1 | S2 | S3 | S4
    trust_level TEXT,               -- T0 | T1 | T2 | T3
    handling_policy TEXT,           -- cloud_ok_encrypted | local_preferred | local_only | s4_isolated

    -- Decay & Lifecycle
    user_locked BOOLEAN,            -- Immun gegen Decay
    decay_eligible BOOLEAN,
    lifecycle TEXT,                 -- session | temporary | permanent | expiry

    -- Tri-temporal
    valid_from TIMESTAMPTZ,         -- Weltzeit: wann gilt der Fakt in der echten Welt
    valid_to TIMESTAMPTZ,           -- Weltzeit: wann hört er auf zu gelten
    ingested_at TIMESTAMPTZ,        -- Wissenszeit: wann hat Ozy davon erfahren
    superseded_at TIMESTAMPTZ,      -- Glaubenszeit: wann hat Ozy aufgehört das zu glauben

    -- Staleness-Detection
    review_due BOOLEAN,
    last_reviewed TIMESTAMPTZ,
    last_accessed TIMESTAMPTZ       -- Für Relevance-Berechnung (Dual-Axis)
)
```

**Wichtige Indizes:**
```sql
-- Conflict Detection (G3): aktive Claims pro Subject+Attribute
idx_claims_subject_attribute ON (user_id, subject, attribute)
    WHERE verification_state NOT IN ('superseded', 'retracted')

-- Bi-temporales Querying
idx_claims_bitemporal ON (user_id, subject, attribute, valid_from, ingested_at)

-- Sensitivity-Filterung im Context Assembler
idx_claims_sensitivity ON (user_id, sensitivity)

-- Decay-Job: nur tentative + decay-eligible
idx_claims_decay ON (decay_eligible, confidence)
    WHERE decay_eligible = TRUE AND verification_state = 'tentative'
```

### `claim_access_log` — Relevance-Tracking

Jeder Zugriff auf einen Claim wird geloggt. Ermöglicht die Dual-Axis-Trennung von Confidence und Relevance.

```sql
claim_access_log (
    access_id UUID PK,
    claim_id UUID FK → claims,
    user_id UUID NOT NULL,
    intent_type TEXT,        -- Bei welchem Intent geladen
    was_cited BOOLEAN,       -- Wurde im LLM-Output referenziert
    provider_id TEXT,        -- Welcher Provider den Claim gesehen hat
    accessed_at TIMESTAMPTZ
)
```

**Kritisch:** `was_cited = true` darf **niemals** automatisch `confidence` erhöhen. Nur Relevance-Score berechnen.

### `claim_versions` — Append-Only Versionshistorie

Jede Änderung an einem Claim erzeugt eine neue Version. SHA-256 Hash-Chain für Integritätsprüfung.

```sql
claim_versions (
    version_id UUID PK,
    claim_id UUID FK → claims,
    version_number INT,          -- Fortlaufend pro Claim
    version_hash TEXT,           -- SHA-256 über content_snapshot
    previous_hash TEXT,          -- Hash der Vorgänger-Version (null = erste Version)
    content_snapshot JSONB,      -- Kompletter Claim-Stand zum Zeitpunkt
    change_reason TEXT,
    changed_by TEXT              -- user | system | decay_job | batch_extract
)
```

**Hash-Chain prüfen:**
```sql
SELECT cv1.version_hash, cv2.previous_hash,
       cv1.version_hash = cv2.previous_hash AS chain_valid
FROM claim_versions cv1
JOIN claim_versions cv2 ON cv1.claim_id = cv2.claim_id
    AND cv1.version_number = cv2.version_number - 1
WHERE cv1.claim_id = '<claim-uuid>';
```

### `memory_proposals` — Proposal-Queue

Alle Proposals warten hier, bevor sie zu Claims werden (G4 Human-in-the-Loop).

```sql
memory_proposals (
    proposal_id UUID PK,
    user_id UUID NOT NULL,
    proposed_claim JSONB,         -- Vollständiger ClaimData-Snapshot
    source_ref TEXT,
    source_type TEXT,             -- user_explicit | model_inferred | connector_data
    status TEXT,                  -- pending | confirmed | rejected | auto_confirmed
    conflict_group_id UUID FK → conflict_groups,
    rejection_reason TEXT,
    decided_at TIMESTAMPTZ,
    decided_by TEXT               -- user | auto_confirm | batch
)
```

### `episodes` — Episodisches Gedächtnis

Append-only Gesprächsarchiv. Jeder Turn erzeugt Episoden für alle Nachrichten (user, assistant, system).

```sql
episodes (
    episode_id UUID PK,
    user_id UUID NOT NULL,
    conversation_id UUID,         -- Gruppiert zusammengehörige Turns
    turn_index INT,               -- Position in der Conversation
    role TEXT,                    -- user | assistant | system
    content TEXT NOT NULL,
    sensitivity TEXT,
    extracted BOOLEAN,            -- Wurde aus dieser Episode schon ein Claim extrahiert?
    extraction_job_id UUID,       -- Welcher Batch-Job hat das verarbeitet
    embedding vector(1536)        -- pgvector: semantische Suche
)
```

**Semantische Suche:**
```sql
-- Ähnliche Episoden zu einem Embedding-Vektor finden
SELECT episode_id, content, 1 - (embedding <=> '[0.1, 0.2, ...]') AS similarity
FROM episodes
WHERE user_id = '<user-uuid>'
  AND sensitivity NOT IN ('S3', 'S4')  -- Privacy-Filter
ORDER BY embedding <=> '[0.1, 0.2, ...]'  -- Cosine Distance
LIMIT 10;
```

---

## Erweiterungen

```sql
-- pgvector: semantische Suche (Voraussetzung für episodes.embedding)
CREATE EXTENSION IF NOT EXISTS vector;

-- pgcrypto: UUID-Generierung (gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Beide Erweiterungen werden automatisch beim Start über `db-init` installiert.

---

## Datenbank-Initialisierung

### Erster Start (Docker)

Der `db-init`-Container führt automatisch `docs/spec/OZY_DB_Schema.sql` aus. Das Schema ist idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).

### Alembic-Migrationen

```bash
cd backend

# Aktuellen Migrations-Stand prüfen
alembic current

# Alle ausstehenden Migrationen anwenden
alembic upgrade head

# Neue Migration erstellen (nach SQLAlchemy-Model-Änderungen)
alembic revision --autogenerate -m "add_new_column_to_claims"

# Migration zurückrollen (eine Stufe)
alembic downgrade -1
```

---

## Nützliche Queries

### Alle aktiven Claims eines Users

```sql
SELECT subject, attribute, value, confidence, verification_state, sensitivity
FROM claims
WHERE user_id = '<uuid>'
  AND verification_state NOT IN ('superseded', 'retracted')
ORDER BY subject, attribute;
```

### Offene Proposals

```sql
SELECT proposal_id, source_type, created_at,
       proposed_claim->>'subject' AS subject,
       proposed_claim->>'value' AS value
FROM memory_proposals
WHERE user_id = '<uuid>'
  AND status = 'pending'
ORDER BY created_at DESC;
```

### Decay-Kandidaten

```sql
SELECT claim_id, subject, attribute, value, confidence, lifecycle
FROM claims
WHERE user_id = '<uuid>'
  AND decay_eligible = TRUE
  AND verification_state = 'tentative'
  AND confidence < 0.5
ORDER BY confidence ASC;
```

### Audit-Trail der letzten 24 Stunden

```sql
SELECT event_type, result, sensitivity, payload, created_at
FROM audit_log
WHERE user_id = '<uuid>'
  AND created_at > now() - interval '24 hours'
  AND sensitivity != 'S4'  -- S4 standardmäßig ausblenden
ORDER BY created_at DESC;
```

### Conflict Groups auflösen

```sql
SELECT cg.group_id, cg.status, cg.created_at,
       array_agg(c.content) AS conflicting_claims
FROM conflict_groups cg
JOIN conflict_group_claims cgc ON cgc.group_id = cg.group_id
JOIN claims c ON c.claim_id = cgc.claim_id
WHERE cg.user_id = '<uuid>'
  AND cg.status = 'pending'
GROUP BY cg.group_id, cg.status, cg.created_at;
```
