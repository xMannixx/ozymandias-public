-- ============================================================
-- OZYMANDIAS NEUBAU — DB-Schema
-- Stand: 03.04.2026, Session 2
-- ============================================================
-- Postgres + pgvector
-- Alle Tabellen mit user_id für Single-Owner,
-- vorbereitet für spätere Multi-User-Erweiterung.
-- ============================================================


-- === CLAIMS (Semantisches Gedächtnis) ===
-- Die Wahrheitsschicht. Jeder Claim ist ein strukturierter Fakt.
CREATE TABLE IF NOT EXISTS claims (
    claim_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,

    -- Strukturierte Felder für Conflict Detection (G3)
    subject             TEXT NOT NULL,          -- Wer/Was ("alex", "kontakt", "auto")
    attribute           TEXT,                   -- Welche Eigenschaft ("wohnort", "beruf") — null bei subjektiven Claims
    value               TEXT NOT NULL,          -- Der Wert ("beispielstadt", "softwareentwicklung")

    -- Freitext + Typ
    content             TEXT NOT NULL,          -- Menschenlesbare Beschreibung
    memory_type         TEXT NOT NULL,          -- "profile", "health", "preference", "relationship", etc.

    -- Authority Lane (Memory v2): identity | preference | evidence | authorization | procedural
    authority_class     TEXT NOT NULL DEFAULT 'evidence',

    -- Governance
    verification_state  TEXT NOT NULL DEFAULT 'tentative'
                        CHECK (verification_state IN ('tentative', 'confirmed', 'superseded', 'retracted')),
                        -- tentative | confirmed | superseded | retracted
    confidence          FLOAT NOT NULL DEFAULT 0.5,
    source_ref          TEXT,                   -- Episode-ID, Turn-ID, Batch-Job-ID
    source_type         TEXT NOT NULL
                        CHECK (source_type IN ('user_explicit', 'model_inferred', 'connector_data', 'user_confirmed')),
                        -- user_explicit | model_inferred | connector_data | user_confirmed

    -- Security & Privacy
    sensitivity         TEXT NOT NULL DEFAULT 'S0'
                        CHECK (sensitivity IN ('S0', 'S1', 'S2', 'S3', 'S4')),
                        -- S0 (öffentlich) | S1 (intern) | S2 (vertraulich) | S3 (strict) | S4 (intimate)
    trust_level         TEXT NOT NULL DEFAULT 'T3'
                        CHECK (trust_level IN ('T0', 'T1', 'T2', 'T3')),
                        -- T0 (untrusted) | T1 (external verified) | T2 (system-internal) | T3 (user-confirmed)
    handling_policy     TEXT NOT NULL DEFAULT 'cloud_ok_encrypted'
                        CHECK (handling_policy IN ('cloud_ok_encrypted', 'local_preferred', 'local_only', 's4_isolated')),
                        -- cloud_ok_encrypted | local_preferred | local_only | s4_isolated

    -- Decay & Lifecycle
    user_locked         BOOLEAN NOT NULL DEFAULT FALSE,     -- Immun gegen Decay und Überschreibung
    decay_eligible      BOOLEAN NOT NULL DEFAULT TRUE,
    lifecycle           TEXT NOT NULL DEFAULT 'permanent'
                        CHECK (lifecycle IN ('session', 'temporary', 'permanent', 'expiry', 'archived')),
                        -- session | temporary | permanent | expiry | archived

    -- Tri-temporal
    valid_from          TIMESTAMPTZ,            -- Weltzeit: wann der Fakt in der echten Welt gilt
    valid_to            TIMESTAMPTZ,            -- Weltzeit: wann der Fakt aufhört zu gelten
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now(),  -- Wissenszeit: wann Ozy davon erfahren hat
    superseded_at       TIMESTAMPTZ,            -- Glaubenszeit: wann Ozy aufgehört hat das zu glauben

    -- Staleness-Detection
    review_due          BOOLEAN NOT NULL DEFAULT FALSE,
    last_reviewed       TIMESTAMPTZ,

    -- Zugriff (für Relevance-Berechnung)
    last_accessed       TIMESTAMPTZ,

    -- System
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conflict Detection: aktive Claims pro Subject+Attribute finden
CREATE INDEX IF NOT EXISTS idx_claims_subject_attribute
    ON claims(user_id, subject, attribute)
    WHERE verification_state NOT IN ('superseded', 'retracted');

-- Bi-temporales Querying: "Was wusste Ozy wann über was?"
CREATE INDEX IF NOT EXISTS idx_claims_bitemporal
    ON claims(user_id, subject, attribute, valid_from, ingested_at);

-- Sensitivity-Filterung im Context Assembler
CREATE INDEX IF NOT EXISTS idx_claims_sensitivity
    ON claims(user_id, sensitivity);

-- Decay-Job: nur tentative + decay-eligible
CREATE INDEX IF NOT EXISTS idx_claims_decay
    ON claims(decay_eligible, confidence)
    WHERE decay_eligible = TRUE
    AND verification_state = 'tentative';

-- Verification-Filter
CREATE INDEX IF NOT EXISTS idx_claims_verification
    ON claims(user_id, verification_state);

-- Staleness-Review im Dashboard
CREATE INDEX IF NOT EXISTS idx_claims_review
    ON claims(user_id, review_due)
    WHERE review_due = TRUE;


-- === CLAIM ACCESS LOG (Relevance-Tracking, Dual-Axis) ===
-- Jeder Zugriff auf einen Claim wird geloggt.
-- Relevance = f(last_accessed, was_cited, intent_match)
-- Anti-Reinforcement Lock: was_cited erhöht Relevance, NIEMALS Confidence.
CREATE TABLE IF NOT EXISTS claim_access_log (
    access_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id            UUID NOT NULL REFERENCES claims(claim_id),
    user_id             UUID NOT NULL,
    intent_type         TEXT NOT NULL,           -- Bei welchem Intent geladen
    was_cited           BOOLEAN NOT NULL DEFAULT FALSE,  -- Wurde im LLM-Output referenziert
    provider_id         TEXT,                    -- Welcher Provider den Claim gesehen hat
    accessed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_log_claim
    ON claim_access_log(claim_id, accessed_at);

CREATE INDEX IF NOT EXISTS idx_access_log_intent
    ON claim_access_log(intent_type, accessed_at);


-- === CLAIM VERSIONS (Append-only Audit Trail) ===
-- Jede Änderung an einem Claim erzeugt eine Version.
-- version_hash + previous_hash für Integritätsprüfung.
CREATE TABLE IF NOT EXISTS claim_versions (
    version_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id            UUID NOT NULL REFERENCES claims(claim_id),
    version_number      INT NOT NULL,
    version_hash        TEXT NOT NULL,           -- SHA-256 über content_snapshot
    previous_hash       TEXT,                    -- Hash der Vorgänger-Version (null bei erster)
    content_snapshot    JSONB NOT NULL,          -- Kompletter Claim-Stand zum Zeitpunkt
    change_reason       TEXT,
    changed_by          TEXT NOT NULL,           -- user | system | decay_job | batch_extract
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Keine doppelten Versionsnummern pro Claim
CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_claim_number
    ON claim_versions(claim_id, version_number);


-- === CONFLICT GROUPS ===
-- Wenn G3 einen echten Widerspruch erkennt (nicht TemporalSuccession),
-- landen die betroffenen Claims in einer Gruppe. Nutzer entscheidet im Dashboard.
CREATE TABLE IF NOT EXISTS conflict_groups (
    group_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'resolved')),
                        -- pending | resolved
    resolution          TEXT,                    -- claim_x_confirmed | merged | both_retracted
    resolved_by         TEXT,                    -- user | auto | batch
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at         TIMESTAMPTZ
);

-- Nur offene Gruppen müssen schnell gefunden werden
CREATE INDEX IF NOT EXISTS idx_conflict_groups_pending
    ON conflict_groups(user_id, status)
    WHERE status = 'pending';

-- Junction statt UUID[]:
-- Stellt referenzielle Integrität zwischen Konfliktgruppen und Claims sicher.
CREATE TABLE IF NOT EXISTS conflict_group_claims (
    group_id            UUID NOT NULL REFERENCES conflict_groups(group_id) ON DELETE CASCADE,
    claim_id            UUID NOT NULL REFERENCES claims(claim_id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, claim_id)
);

CREATE INDEX IF NOT EXISTS idx_conflict_group_claims_claim
    ON conflict_group_claims(claim_id);

-- Bestandsmigration:
-- Falls eine alte Installation noch conflict_groups.claim_ids (UUID[]) nutzt,
-- werden die Werte einmalig in conflict_group_claims ueberfuehrt und die Altspalte entfernt.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'conflict_groups'
          AND column_name = 'claim_ids'
    ) THEN
        EXECUTE '
            INSERT INTO conflict_group_claims(group_id, claim_id)
            SELECT cg.group_id, claim_id
            FROM conflict_groups cg
            CROSS JOIN LATERAL unnest(cg.claim_ids) AS claim_id
            JOIN claims c ON c.claim_id = claim_id
            ON CONFLICT (group_id, claim_id) DO NOTHING
        ';

        EXECUTE 'ALTER TABLE conflict_groups DROP COLUMN claim_ids';
    END IF;
END
$$;


-- === MEMORY PROPOSALS (Warteschlange) ===
-- Kein LLM schreibt direkt in Claims. Alles geht über Proposals.
CREATE TABLE IF NOT EXISTS memory_proposals (
    proposal_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    proposed_claim      JSONB NOT NULL,          -- Kompletter Claim als JSON
    source_ref          TEXT,                    -- Episode-ID, Turn-ID
    source_type         TEXT NOT NULL
                        CHECK (source_type IN ('user_explicit', 'model_inferred', 'connector_data', 'user_confirmed')),
                        -- user_explicit | model_inferred | connector_data | user_confirmed
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'rejected', 'auto_confirmed')),
                        -- pending | confirmed | rejected | auto_confirmed
    conflict_group_id   UUID REFERENCES conflict_groups(group_id),
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at          TIMESTAMPTZ,
    decided_by          TEXT                     -- user | auto_confirm | batch
);

-- Nur offene Proposals müssen schnell gefunden werden
CREATE INDEX IF NOT EXISTS idx_proposals_pending
    ON memory_proposals(user_id, status)
    WHERE status = 'pending';


-- === PROCEDURAL RULES (Prozedurales Gedächtnis) ===
-- 4. Schicht: Arbeitsstil, Tonfall, Mail-Verhalten, Formatierung.
-- Werden bei JEDEM Turn geladen, unabhängig vom Intent.
CREATE TABLE IF NOT EXISTS procedural_rules (
    rule_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    category            TEXT NOT NULL
                        CHECK (category IN ('tone', 'mail_behavior', 'work_style', 'formatting', 'security')),
                        -- tone | mail_behavior | work_style | formatting | security
    rule                TEXT NOT NULL,           -- "Immer duzen", "Mails auf Deutsch", "Keine Emojis"
    priority            INT NOT NULL DEFAULT 0,  -- Höher = wichtiger bei Konflikten
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    sensitivity         TEXT NOT NULL DEFAULT 'S0'
                        CHECK (sensitivity IN ('S0', 'S1', 'S2', 'S3', 'S4')),
    source_type         TEXT NOT NULL
                        CHECK (source_type IN ('user_explicit', 'model_inferred')), -- user_explicit | model_inferred
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nur aktive Regeln laden
CREATE INDEX IF NOT EXISTS idx_rules_active
    ON procedural_rules(user_id, category)
    WHERE active = TRUE;


-- === EPISODEN (Episodisches Gedächtnis) ===
-- Chronologische Aufzeichnung aller Gespräche. Append-only.
-- Batch-Job extrahiert daraus Claims (Episodisch → Semantisch).
CREATE TABLE IF NOT EXISTS episodes (
    episode_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    conversation_id     UUID,
    turn_index          INT,
    role                TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')), -- user | assistant | system
    content             TEXT NOT NULL,
    sensitivity         TEXT NOT NULL DEFAULT 'S0'
                        CHECK (sensitivity IN ('S0', 'S1', 'S2', 'S3', 'S4')),
    extracted           BOOLEAN NOT NULL DEFAULT FALSE,
    extraction_job_id   UUID,                   -- Welcher Batch-Job hat das verarbeitet
    embedding           vector(1536),            -- pgvector für semantische Suche
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Batch-Job: unextrahierte Episoden finden
CREATE INDEX IF NOT EXISTS idx_episodes_unextracted
    ON episodes(user_id, extracted)
    WHERE extracted = FALSE;

-- Gesprächsverlauf rekonstruieren
CREATE INDEX IF NOT EXISTS idx_episodes_conversation
    ON episodes(conversation_id, turn_index);

-- Semantische Suche
CREATE INDEX IF NOT EXISTS idx_episodes_embedding
    ON episodes USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);


-- === CONVERSATIONS (Chat-Verlauf) ===
-- Benannte Chat-Sitzungen fuer die Web-UI. Nachrichten liegen in
-- conversation_messages; episodes bleibt fuer die spaetere
-- Memory-Extraktion (Batch-Job) reserviert.
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    title               TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user
    ON conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
    message_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    user_id             UUID NOT NULL,
    seq                 INT NOT NULL,
    role                TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content             TEXT NOT NULL,
    sensitivity         TEXT NOT NULL DEFAULT 'S0'
                        CHECK (sensitivity IN ('S0', 'S1', 'S2', 'S3', 'S4')),
    provider            TEXT,
    model               TEXT,
    turn_id             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
    ON conversation_messages(conversation_id, seq);


-- === AUDIT LOG ===
-- Lückenlose Protokollierung aller sicherheitsrelevanten Aktionen.
-- Append-only. Nicht löschbar.
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type          TEXT NOT NULL,           -- turn_processed, memory_item_confirmed, action_executed, etc.
    user_id             UUID NOT NULL,
    channel             TEXT NOT NULL CHECK (channel IN ('web', 'telegram', 'system', 'celery')),
                        -- web | telegram | system | celery
    payload             JSONB,                   -- Event-spezifische Details
    source_ref          TEXT,                    -- Referenz auf auslösendes Objekt
    result              TEXT CHECK (result IN ('success', 'failed', 'blocked', 'rolled_back')),
                        -- success | failed | blocked | rolled_back
    sensitivity         TEXT NOT NULL DEFAULT 'S0'
                        CHECK (sensitivity IN ('S0', 'S1', 'S2', 'S3', 'S4')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_event
    ON audit_log(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_user
    ON audit_log(user_id, created_at);

-- S3/S4 Audit-Einträge getrennt auffindbar (gestufte Sichtbarkeit im Dashboard)
CREATE INDEX IF NOT EXISTS idx_audit_sensitivity
    ON audit_log(sensitivity)
    WHERE sensitivity IN ('S3', 'S4');

-- Gezielter JSONB-Index statt pauschalem GIN:
-- Nutzen fuer provider-zentrierte Auswertungen im Turn-Audit.
CREATE INDEX IF NOT EXISTS idx_audit_payload_provider_turn_processed
    ON audit_log ((payload->>'provider'))
    WHERE event_type = 'turn_processed' AND payload IS NOT NULL;


-- === LLM USAGE EVENTS ===
-- Ein Datensatz pro Modell-Aufruf: Tokens, Latenz, Kosten, Fehlerklasse.
-- Enthaelt bewusst keinen Prompt- oder Antworttext, damit auch S3/S4-Traffic
-- messbar bleibt, ohne Inhalte aus seiner Grenze zu tragen.
CREATE TABLE IF NOT EXISTS llm_usage_events (
    usage_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL,
    turn_id              TEXT,
    conversation_id      UUID REFERENCES conversations(conversation_id) ON DELETE SET NULL,
    project_id           UUID REFERENCES projects(project_id) ON DELETE SET NULL,
    call_type            TEXT NOT NULL,           -- chat | claim_extraction | tool_call
    tool_name            TEXT,
    channel              TEXT NOT NULL,
    provider             TEXT NOT NULL,
    model                TEXT NOT NULL,
    sensitivity          TEXT NOT NULL DEFAULT 'S0'
                         CHECK (sensitivity IN ('S0', 'S1', 'S2', 'S3', 'S4')),
    prompt_tokens        INTEGER NOT NULL DEFAULT 0,
    completion_tokens    INTEGER NOT NULL DEFAULT 0,
    cached_prompt_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens         INTEGER NOT NULL DEFAULT 0,
    latency_ms           INTEGER NOT NULL DEFAULT 0,
    cost_usd             NUMERIC(12, 6),          -- NULL = Modell ohne bekannten Preis
    status               TEXT NOT NULL DEFAULT 'ok'
                         CHECK (status IN ('ok', 'error')),
    error_kind           TEXT,                    -- Exception-Klassenname, nie die Meldung
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_created
    ON llm_usage_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_provider_created
    ON llm_usage_events(user_id, provider, created_at DESC);


-- === USER SETTINGS ===
-- Runtime-Settings pro User fuer Guardian/Autopilot und Kill-Switch.
-- user_id als TEXT, da Auth aktuell String-Sub liefert (inkl. dev-user).
CREATE TABLE IF NOT EXISTS user_settings (
    user_id                      TEXT PRIMARY KEY,
    mode                         TEXT NOT NULL DEFAULT 'guardian'
                                 CHECK (mode IN ('guardian', 'autopilot')),
    kill_switch                  BOOLEAN NOT NULL DEFAULT FALSE,
    decay_interval_hours         INT NOT NULL DEFAULT 24,
    decay_confidence_threshold   FLOAT NOT NULL DEFAULT 0.1,
    cb_max_actions_override      INT,
    cb_window_seconds_override   INT,
    cb_cooldown_seconds_override INT,
    preferred_provider           TEXT
                                 CHECK (preferred_provider IN ('deepseek', 'openai', 'ollama', 'gemini', 'lmstudio', 'mistral')),
    preferred_model              TEXT,
    preferred_local_provider     TEXT
                                 CHECK (preferred_local_provider IN ('ollama', 'lmstudio')),
    preferred_local_model        TEXT,
    live_web_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    live_web_mode                TEXT NOT NULL DEFAULT 'provider_native_first'
                                 CHECK (live_web_mode IN ('provider_native_first', 'connector_only', 'off')),
    live_web_s3_confirmed_default BOOLEAN NOT NULL DEFAULT FALSE,
    voice_enabled                BOOLEAN NOT NULL DEFAULT FALSE,
    voice_mode                   TEXT NOT NULL DEFAULT 'push_to_talk'
                                 CHECK (voice_mode IN ('push_to_talk', 'hands_free')),
    tts_voice                    TEXT NOT NULL DEFAULT 'ash',
    tts_model                    TEXT NOT NULL DEFAULT 'tts-1'
                                 CHECK (tts_model IN ('tts-1', 'tts-1-hd')),
    tts_autoplay                 BOOLEAN NOT NULL DEFAULT TRUE,
    openai_api_key               TEXT,
    deepseek_api_key             TEXT,
    gemini_api_key               TEXT,
    mistral_api_key              TEXT,
    anthropic_api_key            TEXT,
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS live_web_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS live_web_mode TEXT NOT NULL DEFAULT 'provider_native_first',
    ADD COLUMN IF NOT EXISTS live_web_s3_confirmed_default BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS openai_api_key TEXT,
    ADD COLUMN IF NOT EXISTS deepseek_api_key TEXT,
    ADD COLUMN IF NOT EXISTS gemini_api_key TEXT,
    ADD COLUMN IF NOT EXISTS mistral_api_key TEXT,
    ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_user_settings_live_web_mode'
    ) THEN
        ALTER TABLE user_settings
            ADD CONSTRAINT chk_user_settings_live_web_mode
            CHECK (live_web_mode IN ('provider_native_first', 'connector_only', 'off'));
    END IF;
END
$$;


-- === GOOGLE TOKENS ===
-- OAuth access/refresh tokens for Gmail and Calendar connector access.
CREATE TABLE IF NOT EXISTS google_tokens (
    user_id         TEXT PRIMARY KEY,
    access_token    TEXT NOT NULL,
    refresh_token   TEXT NOT NULL,
    token_expiry    TIMESTAMPTZ NOT NULL,
    scopes          TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- === PROJEKTE ===
CREATE TABLE IF NOT EXISTS projects (
    project_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
                    -- active | paused | completed | cancelled
    priority        TEXT NOT NULL DEFAULT 'medium',
                    -- low | medium | high | critical
    color           TEXT DEFAULT '#58a6ff',
    start_date      DATE,
    target_date     DATE,
    completed_date  DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_status
    ON projects(user_id, status);

-- === PROJEKT-AUFGABEN ===
-- Meilensteine sind hier aufgegangen: eine Aufgabe mit due_date erfuellt
-- denselben Zweck. Siehe Migrationsblock am Dateiende.
CREATE TABLE IF NOT EXISTS project_tasks (
    task_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'open',
                    -- open | in_progress | done
    priority        TEXT NOT NULL DEFAULT 'medium',
                    -- low | medium | high | critical
    due_date        DATE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_status
    ON project_tasks(project_id, status);

-- === PROJEKT-NOTIZEN ===
CREATE TABLE IF NOT EXISTS project_notes (
    note_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    content         TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'user',
                    -- user | chat | system
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_project
    ON project_notes(project_id, created_at DESC);

-- === PROJEKT-DATEIEN ===
CREATE TABLE IF NOT EXISTS project_files (
    file_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    content_type    TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    minio_bucket    TEXT NOT NULL,
    minio_key       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_project
    ON project_files(project_id, created_at DESC);

-- === PROJEKT-LINKS ===
CREATE TABLE IF NOT EXISTS project_links (
    link_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    name            TEXT NOT NULL,
    url             TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_project
    ON project_links(project_id);

-- === KONTAKTE ===

CREATE TABLE IF NOT EXISTS contacts (
    contact_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          TEXT NOT NULL,
    first_name       TEXT NOT NULL,
    last_name        TEXT,
    company          TEXT,
    role             TEXT,
    phones           JSONB NOT NULL DEFAULT '[]',
    emails           JSONB NOT NULL DEFAULT '[]',
    address          TEXT,
    birthday         DATE,
    notes            TEXT,
    tags             JSONB NOT NULL DEFAULT '[]',
    avatar_minio_key TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_user
    ON contacts(user_id);

CREATE INDEX IF NOT EXISTS idx_contacts_name
    ON contacts(user_id, first_name, last_name);

-- Sensitivity pro Kontakt steuert das Routing: S3/S4 erreichen kein Cloud-Modell,
-- weder als Name noch als Detail. Default S2, weil Kontaktdaten persoenlich sind.
ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS sensitivity TEXT NOT NULL DEFAULT 'S2';
                    -- S0 | S1 | S2 | S3 | S4

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_contacts_sensitivity'
    ) THEN
        ALTER TABLE contacts
            ADD CONSTRAINT chk_contacts_sensitivity
            CHECK (sensitivity IN ('S0', 'S1', 'S2', 'S3', 'S4'));
    END IF;
END
$$;

-- === KONTAKT-PROJEKT-VERKNUEPFUNG ===

CREATE TABLE IF NOT EXISTS contact_projects (
    contact_id UUID NOT NULL REFERENCES contacts(contact_id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contact_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_projects_project
    ON contact_projects(project_id);

-- ============================================================
-- MEMORY v2: Authority Lanes, Recall, Entity-Graph, Procedural
-- ============================================================
-- Idempotenter Zusatz fuer bestehende Installationen.
ALTER TABLE claims
    ADD COLUMN IF NOT EXISTS authority_class TEXT NOT NULL DEFAULT 'evidence';

CREATE INDEX IF NOT EXISTS idx_claims_authority
    ON claims(user_id, authority_class);

-- === RECALL-SNIPPETS (Roh-Recall, getrennt von Fakten) ===
CREATE TABLE IF NOT EXISTS recall_snippets (
    snippet_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    session_id  TEXT,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_snippets_user_session
    ON recall_snippets(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_snippets_expires
    ON recall_snippets(expires_at);

-- === ENTITAETEN (Knoten des Memory-Graphen) ===
CREATE TABLE IF NOT EXISTS memory_entities (
    entity_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    name        TEXT NOT NULL,
    entity_type TEXT,
    attributes  JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ,
    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_entities_user ON memory_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_entities_expires ON memory_entities(expires_at);

-- === RELATIONEN (gerichtete Kanten) ===
CREATE TABLE IF NOT EXISTS memory_entity_relations (
    relation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    subject_id  UUID NOT NULL REFERENCES memory_entities(entity_id),
    predicate   TEXT NOT NULL,
    object_id   UUID NOT NULL REFERENCES memory_entities(entity_id),
    confidence  REAL NOT NULL DEFAULT 0.5,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ,
    UNIQUE (user_id, subject_id, predicate, object_id)
);

CREATE INDEX IF NOT EXISTS idx_relations_subject
    ON memory_entity_relations(subject_id);
CREATE INDEX IF NOT EXISTS idx_relations_object
    ON memory_entity_relations(object_id);
CREATE INDEX IF NOT EXISTS idx_relations_expires
    ON memory_entity_relations(expires_at);

-- === VERHALTENSREGELN (Procedural Lane mit Review-Gate) ===
CREATE TABLE IF NOT EXISTS behavioral_rules (
    rule_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL,
    domain           TEXT NOT NULL DEFAULT 'global',
    behavior_text    TEXT NOT NULL,
    trigger_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    effect_json      JSONB NOT NULL DEFAULT '{}'::jsonb,
    artifact_cost    INT NOT NULL DEFAULT 1,
    status           TEXT NOT NULL DEFAULT 'pending',
                     -- pending | active | rejected | retired
    source_type      TEXT NOT NULL,
    previous_rule_id UUID REFERENCES behavioral_rules(rule_id),
    proposed_by      TEXT,
    decided_by       TEXT,
    decided_at       TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at     TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_behavioral_rules_status
    ON behavioral_rules(user_id, status);
CREATE INDEX IF NOT EXISTS idx_behavioral_rules_domain
    ON behavioral_rules(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_behavioral_rules_expires
    ON behavioral_rules(expires_at);

-- === REGEL-KONFLIKTE ===
CREATE TABLE IF NOT EXISTS behavioral_rule_conflicts (
    conflict_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL,
    rule_id       UUID NOT NULL REFERENCES behavioral_rules(rule_id),
    other_rule_id UUID REFERENCES behavioral_rules(rule_id),
    conflict_type TEXT NOT NULL,   -- direct | interaction | budget | cap
    severity      TEXT NOT NULL,   -- hard | soft
    detail        TEXT,
    resolved      BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_conflicts_rule
    ON behavioral_rule_conflicts(rule_id);

-- ============================================================
-- Migrations-/Architektur-Hinweise
-- ============================================================
-- 1) Kein EXCLUDE-Constraint auf Claims-Überlappungen:
--    Konflikte sollen fachlich erfasst und als conflict_group behandelt werden
--    (Write-Gate / Human-in-the-loop), nicht bereits auf DB-Ebene verworfen.
--
-- 2) Embedding-Strategie:
--    episodes.embedding bleibt im MVP als vector(1536) bestehen.
--    Für Modellwechsel ist ein späteres episode_embeddings-Design vorgesehen
--    (episode_id, model_name, embedding_version, embedding) + Reindex-Migration.

-- 3) Mistral API Integration: Update CHECK constraint for preferred_provider
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_settings_preferred_provider_check'
    ) THEN
        ALTER TABLE user_settings DROP CONSTRAINT user_settings_preferred_provider_check;
    END IF;
    
    ALTER TABLE user_settings
        ADD CONSTRAINT user_settings_preferred_provider_check
        CHECK (preferred_provider IN ('deepseek', 'openai', 'ollama', 'gemini', 'lmstudio', 'mistral'));
END
$$;

-- ============================================================
-- PROJEKT-WORKSPACES: Instruktionen, Wissen, Projekt-Chats
-- ============================================================
-- Idempotenter Zusatz fuer bestehende Installationen.

-- Eigene Instruktionen und Sensitivity-Stufe pro Projekt.
-- sensitivity steuert das Routing: S3/S4 halten Projektwissen lokal.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS instructions TEXT,
    ADD COLUMN IF NOT EXISTS sensitivity TEXT NOT NULL DEFAULT 'S1';
                    -- S0 | S1 | S2 | S3 | S4

-- Aus Dateien extrahierter Text. Nur dieser Text erreicht den LLM-Kontext,
-- nie das Original-Blob aus MinIO.
ALTER TABLE project_files
    ADD COLUMN IF NOT EXISTS extracted_text TEXT,
    ADD COLUMN IF NOT EXISTS extract_status TEXT NOT NULL DEFAULT 'pending',
                    -- pending | ok | unsupported | failed
    ADD COLUMN IF NOT EXISTS text_chars INT NOT NULL DEFAULT 0;

-- Chats gehoeren optional zu einem Projekt. ON DELETE SET NULL, damit ein
-- geloeschtes Projekt den Gespraechsverlauf nicht mitnimmt.
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_project
    ON conversations(project_id, updated_at DESC);

-- Meilensteine werden zu Aufgaben mit Datum. Der Guard laeuft genau einmal,
-- weil die Quelltabelle im selben Block entfernt wird.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'project_milestones'
    ) THEN
        INSERT INTO project_tasks (project_id, user_id, name, status, priority, due_date, sort_order, created_at)
        SELECT project_id,
               user_id,
               name,
               CASE WHEN completed THEN 'done' ELSE 'open' END,
               'high',
               due_date,
               sort_order,
               created_at
        FROM project_milestones;

        DROP TABLE project_milestones;
    END IF;
END
$$;

-- Risiken entfallen als eigene Entitaet. Bestehende Eintraege werden als
-- Notiz archiviert, damit kein Inhalt verloren geht.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'project_risks'
    ) THEN
        INSERT INTO project_notes (project_id, user_id, content, source, created_at)
        SELECT project_id,
               user_id,
               'Archived risk (' || severity || ', ' || status || '): ' || name
                   || COALESCE(chr(10) || description, ''),
               'system',
               created_at
        FROM project_risks;

        DROP TABLE project_risks;
    END IF;
END
$$;
