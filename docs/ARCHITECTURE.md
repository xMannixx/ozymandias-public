# Ozymandias — Systemarchitektur

> Referenz: `OZY_ZUSAMMENFASSUNG_v5_2026-04-03.md`, `RUST_CORE.md`, `TURN_PIPELINE.md`

---

## 1. Schichtenmodell

Ozymandias ist in **vier klar getrennte Schichten** aufgebaut. Jede Schicht hat genau eine Verantwortung und darf nur über definierte Schnittstellen mit anderen Schichten kommunizieren.

```
┌─────────────────────────────────────────────────────────────┐
│  SCHICHT 4: FRONTEND                                        │
│  React 19 + TypeScript + Vite + Tailwind CSS                │
│  NOC-Theme · PWA · Dashboard · Chat · Memory · Audit        │
└────────────────────────┬────────────────────────────────────┘
                         │ REST / JSON (JWT Bearer)
┌────────────────────────▼────────────────────────────────────┐
│  SCHICHT 3: PYTHON-BACKEND (FastAPI)                        │
│  Orchestrierung · LLM-Calls · DB-Zugriff · Celery-Tasks     │
│  16 API-Router · SQLAlchemy 2.0 · Pydantic v2               │
└──────────┬─────────────────────────────┬────────────────────┘
           │ PyO3 (in-process)            │ asyncpg
┌──────────▼──────────┐       ┌──────────▼──────────────────┐
│  SCHICHT 2: RUST    │       │  SCHICHT 1: DATEN            │
│  ozy-contracts      │       │  Postgres 17 + pgvector      │
│  ozy-core           │       │  Redis 7 (Circuit Breaker)   │
│  ozy-bindings       │       │  MinIO (File Storage)        │
└─────────────────────┘       └─────────────────────────────┘
```

### Warum Rust?

Rust übernimmt alles, was **synchron, deterministisch und sicherheitskritisch** ist:
- Schema-Validierung (G1)
- Source-Provenance-Check (G2)
- Conflict Detection (G3)
- Sensitivity-Routing und Payload-Checks
- Taint-Tracking über Tool-Chains
- Circuit-Breaker-Logik
- Token-Budget-Allokation
- Audit-Entry-Validierung
- Decay-Engine

**Kein I/O in Rust** — keine DB-Zugriffe, keine HTTP-Calls, keine Async-Runtime. Das macht den Rust-Kern deterministisch testbar und beweisbar korrekt.

### Warum Python?

Python ist der **flexible Dirigent**:
- LLM-Aufrufe (async, verschiedene Provider)
- Datenbankoperationen (SQLAlchemy async)
- Business-Orchestrierung (Turn-Service, Proposal-Service)
- Hintergrund-Tasks (Celery, Decay-Jobs)
- Google OAuth, Gmail, Calendar
- File-Uploads (MinIO)
- API-Routing (FastAPI)

---

## 2. Rust-Workspace-Struktur

```
rust/
├── Cargo.toml                    # Workspace-Root
├── ozy-contracts/                # Shared Type Library
│   └── src/
│       ├── enums.rs              # Alle Enumerationen (Sensitivity, TrustLevel, ...)
│       ├── structs.rs            # Alle Datenstrukturen (ClaimData, AuditEntry, ...)
│       └── error.rs              # OzyError-Enum
├── ozy-core/                     # Validierungs- und Governance-Module
│   └── src/
│       ├── write_gates.rs        # G1, G2, G3 (Schema, Provenance, Conflicts)
│       ├── sensitivity_router.rs # filter_claims, check_payload_sensitivity
│       ├── taint_tracker.rs      # compute_taint, check_tainted_action
│       ├── circuit_breaker.rs    # check_circuit_breaker
│       ├── decay_engine.rs       # evaluate_decay
│       ├── policy_resolver.rs    # resolve_approval
│       ├── token_budget.rs       # allocate_token_budget
│       └── audit_validator.rs    # validate_audit_entry
└── ozy-bindings/                 # PyO3-Bridge
    └── src/
        └── lib.rs                # Python-Modul mit allen exportierten Funktionen
```

Vollständige Dokumentation: [`RUST_CORE.md`](RUST_CORE.md)

---

## 3. Python-Backend-Struktur

```
backend/
├── Dockerfile
├── pyproject.toml                # Tool-Konfiguration (Ruff, Mypy, Pytest)
├── requirements.txt              # Produktions-Abhängigkeiten
├── requirements-dev.txt          # Entwicklungs-Abhängigkeiten
├── alembic.ini                   # Alembic-Konfiguration
├── alembic/                      # DB-Migrationen
│   └── versions/                 # Migrations-Dateien
├── app/
│   ├── main.py                   # FastAPI App-Factory, Middleware, Router-Registration
│   ├── config.py                 # Settings (Pydantic BaseSettings, .env)
│   ├── database.py               # SQLAlchemy async Engine, Session-Factory
│   ├── api/                      # Route-Handler (FastAPI Routers)
│   │   ├── audit.py              # GET /audit
│   │   ├── auth.py               # GET/POST /auth/*
│   │   ├── calendar.py           # GET/POST /calendar/events
│   │   ├── claims.py             # CRUD + State-Transitions /claims/*
│   │   ├── contacts.py           # CRUD /contacts
│   │   ├── files.py              # Upload/Download /files
│   │   ├── health.py             # GET /health
│   │   ├── llm.py                # GET /llm/providers
│   │   ├── mail.py               # GET /mail
│   │   ├── projects.py           # CRUD /projects (+ sub-resources)
│   │   ├── proposals.py          # GET + approve/reject /proposals
│   │   ├── settings.py           # GET/PUT /settings
│   │   ├── stats.py              # GET /stats
│   │   ├── turns.py              # POST /turns (Haupt-KI-Endpunkt)
│   │   └── voice.py              # POST /voice/transcribe, /voice/synthesize
│   ├── models/                   # SQLAlchemy ORM-Modelle
│   │   ├── audit.py              # AuditLog
│   │   ├── claim.py              # Claim, ClaimVersion, ClaimAccessLog
│   │   ├── conflict.py           # ConflictGroup
│   │   ├── contact.py            # Contact, ContactProject
│   │   ├── google_tokens.py      # GoogleTokens
│   │   ├── project.py            # Project, Milestone, Task, Risk, Note, File, Link
│   │   ├── proposal.py           # MemoryProposal
│   │   ├── settings.py           # UserSettings
│   │   └── user.py               # User (Auth)
│   ├── schemas/                  # Pydantic v2 Schemas
│   │   ├── api_models.py         # TurnRequest/Result, ClaimProcessResult, etc.
│   │   ├── approval.py           # ApprovalRequest/Decision
│   │   ├── audit.py              # AuditEntry, AuditValidationResult
│   │   ├── circuit_breaker.py    # CircuitBreakerConfig/Status
│   │   ├── claim.py              # ClaimData, ClaimResponse
│   │   ├── contracts.py          # Enums (Sensitivity, TrustLevel, ...)
│   │   ├── decay.py              # DecayAction, DecayActionType
│   │   ├── proposal.py           # ProposalData, ProposalResponse
│   │   ├── sensitivity.py        # SensitivityFilterInput/Output, PayloadSensitivityInput
│   │   ├── taint.py              # TaintChunk, TaintContext, TaintSummary
│   │   └── token_budget.py       # TokenBudgetRequest/Allocation
│   └── services/                 # Business-Logik
│       ├── audit_service.py      # Append-Only Logging
│       ├── calendar_service.py   # Google Calendar
│       ├── circuit_breaker_service.py  # Redis-backed Velocity Tracking
│       ├── claim_service.py      # CRUD + Versioning + Hash-Chain
│       ├── contact_service.py    # CRUD + Avatar-Upload
│       ├── decay_service.py      # Celery-Task für Memory-Decay
│       ├── file_service.py       # MinIO Upload/Download
│       ├── gmail_service.py      # Google Mail
│       ├── project_service.py    # CRUD für Projekte + Sub-Ressourcen
│       ├── proposal_service.py   # Proposal-Workflow
│       ├── rust_bridge.py        # PyO3-Wrapper-Aufrufe
│       ├── settings_service.py   # User-Settings
│       ├── stats_service.py      # Aggregat-Statistiken
│       ├── turn_service.py       # Turn-Orchestrierung (Kern-Pipeline)
│       ├── utils.py              # Hilfsfunktionen
│       └── llm/                  # LLM-Provider-Layer
│           ├── base.py           # LLMProvider-Interface, LLMMessage, LLMResponse
│           ├── router.py         # LLMRouter — Sensitivity + Intent → Provider
│           ├── deepseek.py       # DeepSeek-Provider
│           ├── gemini.py         # Google Gemini-Provider
│           ├── openai_provider.py # OpenAI-Provider
│           ├── ollama.py         # Ollama-Provider (lokal)
│           ├── lmstudio.py       # LM Studio-Provider (lokal)
│           ├── claim_extractor.py # LLM-basierte Claim-Extraktion
│           ├── context_assembler.py # Token-Budget-gesteuerter Context-Aufbau
│           ├── sensitivity_classifier.py # LLM-basierte Sensitivity-Einstufung
│           ├── system_prompt.py  # Ozy-Basis-System-Prompt
│           ├── tts.py            # OpenAI TTS
│           └── whisper.py        # OpenAI Whisper STT
└── tests/                        # Pytest-Suites
```

---

## 4. Frontend-Struktur

```
frontend/
├── Dockerfile
├── vite.config.ts
├── tsconfig.json
├── vitest.config.ts
├── index.html
└── src/
    ├── App.tsx                   # Root-Komponente, Routing
    ├── main.tsx                  # Entry Point
    ├── api/                      # API-Client-Layer (fetch-Wrapper)
    ├── components/               # Wiederverwendbare UI-Komponenten
    │   ├── layout/               # AppShell, Sidebar, Header
    │   ├── common/               # Button, Card, Badge, Modal
    │   ├── chat/                 # Chat-Bubbles, Input, Voice-Controls
    │   ├── memory/               # ClaimCard, ProposalCard, ConflictGroup
    │   ├── audit/                # AuditFeed, AuditEntry
    │   ├── dashboard/            # BriefingWidget, StatsCard
    │   ├── calendar/             # WeekView, EventCard
    │   ├── mail/                 # InboxList, MailDetail
    │   ├── projects/             # ProjectCard, MilestoneList, TaskBoard
    │   ├── contacts/             # ContactCard, ContactDetail
    │   ├── proposals/            # ProposalInbox, ProposalCard
    │   ├── settings/             # SettingsForm, ProviderSelector
    │   └── auth/                 # AuthGuard
    ├── pages/                    # Seiten-Komponenten
    │   ├── DashboardPage.tsx
    │   ├── ChatPage.tsx
    │   ├── MemoryPage.tsx
    │   ├── ProposalsPage.tsx
    │   ├── AuditPage.tsx
    │   ├── SettingsPage.tsx
    │   ├── CalendarPage.tsx
    │   ├── MailPage.tsx
    │   ├── ProjectsPage.tsx
    │   ├── ContactsPage.tsx
    │   └── LoginPage.tsx
    ├── store/                    # Zustand-Stores (State Management)
    │   ├── authStore.ts          # JWT, Dev-Bypass, Login/Logout
    │   └── modeStore.ts          # Guardian/Autopilot-Modus-Indikator
    ├── hooks/                    # Custom React Hooks
    └── constants/                # App-Konstanten, Theme-Farben
```

Vollständige Dokumentation: [`FRONTEND.md`](FRONTEND.md)

---

## 5. Infrastruktur-Übersicht

```
docker-compose.yaml definiert:

ozy-postgres     pgvector/pgvector:pg17    Port 5432
ozy-redis        redis:7-alpine            Port 6379
ozy-minio        minio/minio:latest        Port 9000/9001
ozy-db-init      postgres:17-alpine        (einmalig, läuft Schema-SQL)
ozy-pg-backup    postgres:17-alpine        (täglich pg_dump, 7-Tage-Rotation)
ozy-backend      ./backend/Dockerfile      Port 8000
ozy-frontend     ./frontend/Dockerfile     (baut React-Bundle in Volume)
ozy-nginx        nginx:1.28-alpine         Port 8080 (Prod)
```

### Netzwerk-Fluss (Produktion)

```
Browser/Client
    ↓ HTTPS:8080
ozy-nginx  (Reverse Proxy)
    ├── /api/*  → ozy-backend:8000
    └── /*      → React SPA (statische Dateien aus Volume)

ozy-backend
    ├── postgres:5432  (DB)
    ├── redis:6379     (Circuit Breaker, Celery Broker)
    ├── minio:9000     (File Storage)
    └── LLM-APIs       (extern: DeepSeek, Gemini, OpenAI / intern: Ollama, LM Studio)
```

### Volumes (NIEMALS mit `down -v` löschen!)

| Volume | Inhalt | Kritikalität |
|---|---|---|
| `postgres_data` | Alle Claims, Memory, Projekte, Audit-Log | 🔴 KRITISCH |
| `pg_backups` | Tägliche SQL-Dumps (7 Tage) | 🟠 Wichtig |
| `redis_data` | Circuit-Breaker-State (verlierbar) | 🟡 Unkritisch |
| `minio_data` | Hochgeladene Dateien | 🟠 Wichtig |
| `frontend_dist` | Gebundelte React-App | 🟢 Reproduzierbar |

---

## 6. Sicherheitsmodell

### Authentifizierung

```
Produktion:  JWT Bearer Token
             Google OAuth 2.0 (Gmail + Calendar)

Entwicklung: AUTH_DEV_BYPASS=true
             → Fixer Dev-User ("dev-user") ohne Token-Prüfung
```

### Autorisierungs-Hierarchie

| Level | Identität | Rechte |
|---|---|---|
| A0 | Externer Content (Mails, RAG, Connectoren) | Nur Daten liefern |
| A1 | Standard-User (Web, Telegram + JWT) | Klasse 1–3 bestätigen |
| A2 | Root/Break-Glass (lokale Console) | Klasse 4, S3-Daten, Core-Invarianten |

### Sensitivity-Routing (Kurzfassung)

| Label | Routing |
|---|---|
| S0 · S1 | Alle Provider |
| S2 | Nur verschlüsselte Provider |
| S3 | Nur lokale Modelle (Ollama/LM Studio) |
| S4 | Nur lokal + intent `intimate_reflection` + S4-Lockdown |

Details: [`SENSITIVITY_ROUTING.md`](SENSITIVITY_ROUTING.md)

---

## 7. CI/CD-Pipeline

GitHub Actions Workflows unter `.github/workflows/`:

### PR Gate (`pr.yml`)

Läuft bei jedem Pull Request:

1. **Rust** — `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test --workspace`
2. **Python** — `ruff check`, `ruff format --check`, `mypy`, `pytest`
3. **DB-Migration-Sanity** — Alembic `upgrade head` gegen Test-Postgres
4. **Bindings-Smoke** — PyO3-Bridge importierbar und Basis-Funktionen aufrufbar
5. **Security-Scan** — Dependency-Audit (Rust + Python)

### Nightly

- Vollständige Test-Suite mit Integrations-Tests
- DB-Schema-Diff-Check
- Dependency-Update-Check

### Release

- Rust-Binaries bauen
- Docker-Images bauen und taggen
- CHANGELOG automatisch aktualisieren

---

## 8. Entwicklungsworkflow

```bash
# 1. Rust-Kern bauen und testen
cd rust
cargo fmt
cargo clippy --all-targets -- -D warnings
cargo test --workspace

# 2. Python-Backend
cd backend
pip install -r requirements.txt -r requirements-dev.txt
python -m ruff check app tests
python -m mypy --config-file pyproject.toml app tests
python -m pytest -q tests/

# 3. Frontend
cd frontend
npm install
npm run dev          # Dev-Server auf :5173
npm run test         # Vitest
npm run build        # Prod-Build

# 4. Gesamtsystem starten
docker compose up --build
# Backend:  http://localhost:8000
# API-Docs: http://localhost:8000/docs
# Frontend: http://localhost:8080 (Nginx) oder :5173 (Dev)
```
