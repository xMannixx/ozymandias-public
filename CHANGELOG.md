# Changelog

Alle wichtigen Änderungen an Ozymandias werden in dieser Datei dokumentiert.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

---

## [0.1.0] — 2026-06-13

### Hinzugefügt

#### Rust-Kern (`rust/`)
- `ozy-contracts`: Vollständige Typen-Bibliothek — Enums (Sensitivity S0–S4, TrustLevel T0–T3, AuthorityLevel A0–A2, ApprovalClass 0–4, VerificationState, Lifecycle, SourceType, MemoryType, ProposalStatus, ConflictGroupStatus, AuditEventType, AuditResult, Channel, Role, RuleCategory, FilterReason, HandlingPolicy), Structs (ClaimData, ProposalData, ConflictGroupData, WriteGateInput, G1/G2/G3Result, SensitivityFilterInput/Output, PayloadSensitivityInput/Result, ApprovalRequest/Decision, AuditEntry, CircuitBreakerConfig/Status, TokenBudgetRequest/Allocation, DecayAction) sowie OzyError-Enum
- `ozy-core`: Sensitivity Router (`filter_claims`, `check_payload_sensitivity`) mit Routing-Regeln für S0–S4
- `ozy-core`: Write-Gates G1 (Schema-Validierung), G2 (Source Provenance), G3 (Conflict Detection) mit TemporalSuccession-Logik und InvariantViolation bei locked Claims
- `ozy-core`: Decay Engine mit exponentiellem Confidence-Zerfall (Lifecycle-basiert: Permanent/Session/Expiry/Temporary), ISO-8601-Parser ohne externe Abhängigkeiten
- `ozy-core`: Circuit Breaker mit konfigurierbarem Zeitfenster und Cooldown-Logik
- `ozy-core`: Token Budget Allocator (Knapsack-Logik)
- `ozy-core`: Policy Resolver (Approval-Klassen-Einstufung)
- `ozy-core`: Taint Tracker (Propagierung von Untrusted-Tags durch Tool-Chains)
- `ozy-core`: Audit Validator (Validierung von AuditEntry-Strukturen)
- `ozy-bindings`: PyO3-Wrapper für alle ozy-core-Funktionen, Smoke-Tests vorhanden

#### Python-Backend (`backend/`)
- FastAPI-Anwendung mit Lifespan-Hook, CORS-Middleware, 16 API-Routern
- SQLAlchemy 2.0 Modelle: Claim, ClaimVersion, MemoryProposal, ConflictGroup, AuditLog, User, Project (+ Milestones/Tasks/Risks/Notes/Files/Links), Contact (+ ContactProject), Settings, GoogleTokens
- Alembic-Migrationsinfrastruktur mit initialer Migration für alle Tabellen
- Pydantic v2 Schemas: api_models, contracts, approval, audit, circuit_breaker, claim, decay, proposal, sensitivity, taint, token_budget
- Auth-Layer: JWT-Authentifizierung (PyJWT), Google OAuth 2.0-Flow (Gmail + Calendar Scopes), Dev-Bypass-Modus
- Claim-Service: CRUD, Confirm/Retract/Archive/Lock/Unlock/Sensitivity-Update, Versionierung (SHA-256 Hash-Chain)
- Proposal-Service: Pending/Confirmed/Rejected/AutoConfirmed Workflow
- Audit-Service: Append-Only Logging mit Rust-Validierung, Sensitivity-gesteuerter Sichtbarkeit (S4 standardmäßig ausgeblendet)
- Turn-Service: Vollständige Turn-Orchestrierung inkl. Sensitivity-Klassifikation, Context Assembly, LLM-Routing, Claim-Extraktion, Write-Gate-Pipeline, Taint-Tracking, Circuit-Breaker-Prüfung
- Decay-Service: Celery-Task `ozy.decay.run` mit Rust-Logik-Aufruf
- Circuit-Breaker-Service: Redis-backed Velocity Tracking
- LLM-Router: Sensitivity- und Intent-gesteuertes Provider-Routing (DeepSeek, Gemini, OpenAI, Ollama, LM Studio)
- LLM-Provider: DeepSeek, Gemini, OpenAI, Ollama, LM Studio — alle normalisiert auf LLMProvider-Basisklasse
- Claim-Extractor: LLM-basierte Claim-Extraktion aus Turn-Inhalt
- Context Assembler: Token-Budget-gesteuertes Laden von Claims, Episoden und prozeduralen Regeln
- System-Prompt: Ozy-Basis-Instruktionen
- Sensitivity Classifier: LLM-basierte Einstufung von Turn-Inhalten
- TTS/Whisper: OpenAI TTS + Whisper STT Integration
- Google Connector: Gmail-Lesen, Calendar-Lesen/Schreiben, OAuth-Flow
- File-Service: MinIO-Upload/-Download/-Delete mit Bucket-Verwaltung
- Settings-Service: User-spezifische Einstellungen (Mode, Kill-Switch, Decay, Circuit-Breaker, Provider)
- Stats-Service: Aggregate über Audit-Log und Claims
- Kontakt-Service: CRUD für Kontakte inkl. Avatar-Upload
- Projekt-Service: CRUD für Projekte, Meilensteine, Tasks, Risiken, Notizen, Dateien, Links

#### Frontend (`frontend/`)
- React 19 + TypeScript 6 + Vite 8 + Tailwind CSS 4 App-Grundstruktur
- Routing: React Router 7, AppShell mit AuthGuard
- Store: Zustand-basiertes Auth-Store (JWT, Dev-Bypass), Mode-Store (Guardian/Autopilot)
- Seiten: Chat, Memory, Proposals, Audit, Dashboard, Settings, Calendar, Mail, Projects, Contacts, Login
- API-Client-Layer für alle Backend-Endpunkte
- Dunkles NOC-Theme (#0d1117), Glassmorphism, Neon-Akzente
- Grundkomponenten für alle Bereiche (Audit, Chat, Calendar, Contacts, Dashboard, Mail, Memory, Projects, Proposals, Settings)

#### Infrastruktur
- `docker-compose.yaml`: Postgres + pgvector, Redis, MinIO, Backend, Frontend-Build, Nginx
- `docs/spec/OZY_DB_Schema.sql`: Vollständiges Datenbankschema mit allen Tabellen und Indizes
- Nginx-Konfiguration mit SPA-Routing und API-Proxy
- GitHub Actions: PR Gate (Rust-Tests + Python-Lint/Typen/Tests + DB-Migration-Sanity + Bindings-Smoke + Security-Scan), Nightly, Release-Workflow
- Backup-Container: Tägliche pg_dump-Sicherung mit 7-Tage-Rotation

#### Memory v2 — Authority Lanes (`backend/app/memory/`)
- Authority Lanes (`identity`, `preference`, `evidence`, `authorization`, `procedural`) mit eigener Source-Trust-Write-Policy, TTL/Decay und single-valued-Konfliktauflösung; neue Spalte `authority_class` auf `claims`
- Query-aware Recall: deutsche Volltext-Normalisierung, editierbarer Synonym-Map, Stem-Scoring und Pro-Lane-Budgets (deterministisch, ohne Embeddings)
- Recall-Snippets (`recall_snippets`) für Roh-Gesprächsabruf
- Entity-Relations-Graph (`memory_entities`, `memory_entity_relations`)
- Prozedurale Lane: selbstgeschriebene Verhaltensregeln (`behavioral_rules`, `behavioral_rule_conflicts`) mit Pflicht-Review (Guardian-Approval), deterministischer Konflikterkennung und beschränkter, sanitisierter Injektion
- Provenance-Rekonstruktion aus dem Append-Only-Audit-Log sowie Snapshot/Restore strukturierter Memory-Daten
- Lane-gekoppeltes Decay/Cleanup als Celery-Task
- API unter `/memory` (facts, recall, snippets, entities, relations, rules + conflicts, provenance, stats, snapshot) und Frontend-Review-UI für Verhaltensregeln

#### Live-Web, Provider-Resilienz & Health
- Optionaler Live-Web-Connector (konfigurierbar) mit Modus „provider-nativ zuerst" / „connector-only" / „off"; S4 gesperrt, S3 erfordert explizite Bestätigung
- Router-Fallback via `LocalProviderUnavailableError` / `LiveWebPermissionRequiredError`, damit Chat ohne erreichbares lokales Modell nutzbar bleibt
- `/health` mit Pro-Provider-Runtime-Probe (Ollama/LM Studio erreichbar?) und Live-Web-Status
- Frontend: Live-Web-Toggles, Provider-/Live-Web-Health in der System-Health-Anzeige, persistente Provider-/Modell-Auswahl im Chat
- End-to-end Voice-Flow (STT/TTS) mit Push-to-Talk und Freisprech-Modus

### Geändert

- Sensitivity-Klassifikation degradiert bei nicht erreichbarem lokalem Classifier nachvollziehbar zu S1 (mit Provenance) statt hart fail-closed S3 — der Chat bleibt nutzbar
- Conflict-Groups von `claim_ids` (UUID[]) auf eine Junction-Tabelle (`conflict_group_claims`) für referenzielle Integrität normalisiert, inkl. idempotenter In-Place-Migration
- `OZY_DB_Schema.sql`: CHECK-Constraints für Claim-Enums (verification_state, source_type, sensitivity, trust_level, handling_policy, lifecycle)

### Behoben

- STT-Content-Type-Parsing im Voice-Endpoint toleriert nun `;`-Parameter (z. B. Charset)
- Zeitzonenabhängiger Frontend-Test (`EventCreate`) leitet erwartete ISO-Zeiten aus derselben lokalen Konvertierung ab
- Pre-existierende Ruff-E501-Verstöße im Kontakt-Modell und Context-Assembler-Test behoben

---

## Geplante Phasen (Roadmap)

| Phase | Inhalt | Status |
|---|---|---|
| **Phase 1 — Trust Core** | Rust-Kern + Write-Gates + Sensitivity + Audit | ✅ Fertig |
| **Phase 2 — Memory & Claims** | Memory-Pipeline, Proposals, Decay + Memory v2 (Authority Lanes) | ✅ Fertig |
| **Phase 3 — Context & LLM** | Context Assembler, LLM-Router, Claim-Extraktion, Live-Web, Resilienz | ✅ Fertig |
| **Phase 4 — Connectors** | Google Gmail/Calendar, Taint-Tracking, MCP-Grundlage | 🚧 In Arbeit |
| **Phase 5 — Dashboard** | React-Frontend vollständig, NOC-Theme, PWA | ✅ Weitgehend fertig |
| **Phase 6 — Mobile/Telegram** | Mobile APK + Bot-Integration als mobiler Kanal | 🔜 Geplant |
| **Phase 7 — Batch & Eval** | DeepSeek Batch-API, Eval-Suiten, Nachtjobs | 🔜 Geplant |
| **Phase 8 — Hardening** | Security-Audit, Penetration Testing, DSGVO-Compliance | 🔜 Geplant |

---

[0.1.0]: https://github.com/xMannixx/ozymandias-public/releases/tag/v0.1.0
