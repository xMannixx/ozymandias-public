# Changelog

Alle wichtigen Änderungen an Ozymandias werden in dieser Datei dokumentiert.

Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unveröffentlicht]

### Hinzugefügt

#### Projekt-Workspaces
- Projekte sind Arbeitsbereiche statt Ablagen: eigener Gesprächsverlauf pro Projekt (`conversation_service`), Wissensdokumente, Custom Instructions und Referenz-Links
- `project_context_service` legt Projektwissen und Instruktionen automatisch in den Kontext der Antworten
- Frontend: Workspace-Seite mit Tabs (Chat, Knowledge, Instructions, Plan), aktiver Workspace sichtbar in Chat und Dashboard, Deep-Links über Nginx bedient

#### Verbrauchserfassung und Usage-Seite
- Provider melden Prompt-, Completion- und Cached-Tokens pro Aufruf; Router und Claim-Extractor erfassen zusätzlich Latenz und Versuch
- Listenpreis-Tabelle (`llm/pricing.py`) rechnet Tokens in Dollar um; pro LLM-Aufruf eines Turns wird ein Usage-Event gespeichert
- `usage_service` aggregiert zu einem Report pro Zeitraum: Durchsatz, Tokens, Kosten, Cache-Trefferquote, Fehlerquote, Top-Listen nach Modell, Provider, Werkzeug und Kanal sowie Fehler nach Tag und Stunde
- Neue Usage-Seite im Frontend, Dashboard nach Wissen und Betrieb gruppiert

#### Kontakte im Gesprächskontext
- Neue Spalte `sensitivity` auf `contacts` (Standard S2); als privat markierte Kontakte (S3/S4) erreichen kein Cloud-Modell
- `llm/contact_match.py` entscheidet deterministisch, welche Kontakte eine Nachricht meint (Name, Firma, Rolle, Tag) — inklusive Umlaut-Faltung und Schutz vor mehrdeutigen Vornamen
- Der Context Assembler liefert für genannte Personen den vollständigen Eintrag statt nur den Namen; das Audit-Log hält fest, welche Kontakte das Modell gesehen hat und wie viele zurückgehalten wurden
- Frontend: Datenschutzstufe im Kontaktdetail wählbar, Karten zeigen „Local only"

#### OpenRouter als Provider
- `OPENROUTER_API_KEY` schaltet einen Broker mit mehreren hundert Modellen frei; der Katalog wird live von OpenRouter gelesen (15 min Cache) statt per Hand gepflegt
- Modellauswahl überall über ein gemeinsames, durchsuchbares Dropdown (`ModelPicker`, `useProviderModels`) — nötig, weil eine Liste dieser Größe ohne Filter unbenutzbar ist
- OpenRouter steht am Ende der Cloud-Fallback-Kette: als Broker erreicht er dieselben Anbieter, nur mit Aufschlag und einem Hop mehr

#### Hintergrund-Jobs laufen wirklich
- `backend/app/celery_app.py` mit Redis-Broker, JSON-Serialisierung, UTC und Beat-Zeitplan: Memory-Decay 03:00 UTC, Lane-Cleanup 03:30 UTC
- Neue Beat-Einstiegspunkte `ozy.decay.run_all` und `ozy.memory.cleanup_all`, die ihre Zielnutzer selbst aus den Claims auflösen
- Eigener `worker`-Container im Compose (Celery Worker und Beat in einem Prozessbaum, Healthcheck über `inspect ping`)

### Geändert

- Oberfläche vom Neon-NOC-Theme auf ein ruhiges Glass-Design umgestellt; Dashboard-Kacheln, Chat-Nachrichten und Einstellungen in verständlicher Sprache statt Datenbank-Jargon
- Memory-, Proposals- und Audit-Ansicht erklären Codes und Konfidenzwerte im Klartext (gemeinsame Label-Helfer)
- Oberfläche vollständig englisch; letzte deutsche Beschriftungen in Event-Details und Dashboard ersetzt
- Navigation, Einstellungshierarchie und visuelle Dichte vereinfacht, Chat auf Mobilgeräten nutzbar, Barrierefreiheits-Grundlagen ergänzt
- Projektlöschung räumt abhängige Zeilen jetzt über Postgres-Kaskaden ab
- DeepSeek auf V4 umgestellt (`deepseek-v4-flash`, `deepseek-v4-pro`); die Preistabelle kennt jetzt das Peak-Fenster, in dem DeepSeek doppelt abrechnet, und gespeicherte Präferenzen auf den alten Aliassen werden migriert
- Ob ein Provider verfügbar ist, entscheidet jetzt der vorhandene Schlüssel und nicht der Router-Zustand

### Behoben

- Decay wandte keine einzige seiner Entscheidungen an: Die Engine meldet `claim_ref` als `source_ref`, die Zuordnung suchte aber nach der `claim_id`. Aktionen werden jetzt über die Position gepaart
- Der jeweils zweite Celery-Job eines Laufs starb an „attached to a different loop"; der Verbindungspool wird nach jedem Task geleert
- Durchschnittswerte im Usage-Report zählen nur noch tatsächlich gemessene Antworten
- `/usage` wird als API-Aufruf beantwortet, Navigationen dagegen an die App weitergereicht; ungültige Report-Payloads werden abgewiesen
- Referenz-Links akzeptieren eine reine Webadresse, Eingabefelder ohne expliziten Typ sind gestylt
- Toasts schweben im Viewport statt im Layout, das Dist-Volume wird vor einem neuen Frontend-Build geleert
- Jeder S3/S4-Turn scheiterte mit „Turn processing failed", wenn `OLLAMA_MODEL` auf ein nicht gezogenes Modell zeigte: Die Modellwahl läuft jetzt gegen die installierte Tag-Liste, Streaming inbegriffen, und Embedding-Modelle werden aus Routing und Dropdown ausgeschlossen
- Ein gescheiterter lokaler Versuch wird bei S3/S4 als solcher gemeldet — bisher nur bei Verbindungsfehlern, weshalb der einmalige Cloud-Fallback bei S3 gar nicht angeboten wurde
- Ein über die Oberfläche gespeicherter Cloud-Schlüssel machte den Provider nicht auswählbar („needs an API key first"), ein gelöschter Schlüssel blieb bis zum Neustart wirksam
- Die Vorklassifikation war unbemerkt tot und stufte damit jede Nachricht ohne Keyword-Treffer auf S1 herunter, also in die Cloud: Sie lief gegen `OLLAMA_MODEL`, ohne zu prüfen, ob das Modell installiert ist. Sie nimmt jetzt das kleinste installierte Modell, hält es geladen (~0,15 s pro Nachricht statt Sekunden), unterdrückt den Denkschritt von Reasoning-Modellen — der sonst das Token-Budget verbraucht und eine leere Antwort liefert — und protokolliert jede Degradierung
- Ein bevorzugter Provider ohne Schlüssel wurde stillschweigend durch einen anderen Cloud-Anbieter ersetzt; das steht jetzt im Log
- Der nächtliche Decay-Lauf brach ohne kompilierten Rust-Kern mit einem Fehler ab: Der Dev-Fallback antwortete mit einer leeren Aktionsliste, während der Aufrufer eine Aktion pro Claim erwartet. Er hält jetzt jeden Claim und antwortet in der erwarteten Länge
- `/health` beantwortete einen unbrauchbaren Rust-Kern mit HTTP 500, sobald der Import nicht an einem fehlenden Modul scheiterte, sondern etwa an einem Wheel für eine andere Python-Version
- Der Audit-Validator akzeptierte unmögliche Datumsangaben wie `2026-02-31`, weil er einen eigenen, laxeren ISO-8601-Parser mitführte als die Decay Engine. Beide nutzen jetzt `ozy-core::iso8601`, das zusätzlich Bruchteile feiner als Nanosekunden abschneidet statt den Zeitstempel abzulehnen

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
| **Phase 7 — Batch & Eval** | DeepSeek Batch-API, Eval-Suiten, Nachtjobs | 🚧 Nachtjobs laufen, Batch/Eval offen |
| **Phase 8 — Hardening** | Security-Audit, Penetration Testing, DSGVO-Compliance | 🔜 Geplant |

---

[0.1.0]: https://github.com/xMannixx/ozymandias-public/releases/tag/v0.1.0
