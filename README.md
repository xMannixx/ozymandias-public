# Ozymandias

[![PR Gate](https://github.com/xMannixx/ozymandias-public/actions/workflows/pr.yml/badge.svg)](https://github.com/xMannixx/ozymandias-public/actions/workflows/pr.yml)
[![Lizenz](https://img.shields.io/badge/Lizenz-Apache%202.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.94%2B-orange.svg)](https://www.rust-lang.org/)
[![Python](https://img.shields.io/badge/Python-3.14%2B-blue.svg)](https://www.python.org/)

Persönliche KI-Schaltzentrale. Autonomer Assistent mit langfristigem Memory, Sensitivity-basiertem Privacy-Routing, gehärteter Governance und vollständigem Audit-Trail.

> [!TIP]
> **Neu bei Ozymandias?** Lies das leicht verständliche [Benutzerhandbuch & Administrator-Leitfaden (USER_GUIDE.md)](docs/USER_GUIDE.md) für eine Schritt-für-Schritt-Anleitung zur Nutzung und Verwaltung von Gedächtnis, Vorschlägen (Proposals) und Datenschutzstufen.

## Inhaltsverzeichnis

- [Schnellstart](#schnellstart)
- [Benutzerhandbuch & Anleitungen](#benutzerhandbuch--anleitungen)
- [Architektur](#architektur)
- [Kernkonzepte](#kernkonzepte)
- [Tech Stack](#tech-stack)
- [Projektstruktur](#projektstruktur)
- [Status](#status)
- [Entwicklung](#entwicklung)
- [Lizenz](#lizenz)

## Schnellstart

Für den Einstieg unter Windows steht ein interaktiver Launcher zur Verfügung:

```cmd
.\bootstrap.cmd
```

Dieses Skript führt dich durch den Setup-Prozess und bietet dir zwei Pfade zur Installation an:

### Pfad A: Schnelle Evaluierung (Empfohlen zum Ausprobieren)

Dieser Modus umgeht die Rust-Kompilierung auf dem Host und nutzt das integrierte Python-Fallback-Modul. Außerdem wird die Authentifizierungsseite deaktiviert, damit du direkt starten kannst.

1. Kopiere `.env.example` nach `.env`.
2. Setze in deiner `.env`:

   ```env
   AUTH_DEV_BYPASS=true
   VITE_AUTH_BYPASS=true
   ```

3. Starte das System mit Docker:

   ```bash
   docker compose up -d
   ```

4. Öffne `http://localhost:8080` in deinem Browser.

### Pfad B: Vollständiger Entwickler-Build (Voller Stack)

Nutzt den vollständigen, in Rust geschriebenen Governance- und Validierungs-Kern. Der Build des Rust-Kerns erfolgt vollautomatisch im Docker-Container.
*Voraussetzungen:* Docker

```bash
# 1. .env vorbereiten
cp .env.example .env

# 2. Stack starten (baut Rust, Python & Frontend automatisch im Container)
docker compose up -d --build
```

Das Backend ist danach unter `http://localhost:8000` erreichbar, das Frontend über Nginx auf `http://localhost:8080`.

## Benutzerhandbuch & Anleitungen

Im [Benutzerhandbuch (docs/USER_GUIDE.md)](docs/USER_GUIDE.md) findest du detaillierte Schritt-für-Schritt-Anleitungen für typische Anwendungsfälle, darunter:
- **Fakten hinzufügen:** Wie Ozy sich implizit oder explizit Dinge im Chat merkt.

- **Proposals validieren:** Wie du Vorschläge freigibst oder editierst.

* **Konflikte auflösen:** Was passiert, wenn sich Aussagen widersprechen.
- **Datenschutz konfigurieren:** Steuerung der Sensitivity-Klassen (S0 bis S4).

## Architektur

**Rust-Kern** — Synchrone Validierung, Governance, Memory-Regeln. Kein I/O, keine DB — reine Grenzwächter.

- `ozy-contracts` — Typen, Enums, Error-Types. Kein Verhalten.
- `ozy-core` — Sensitivity Router, Write-Gates, PolicyResolver, Circuit Breaker, Taint Tracker.
- `ozy-bindings` — PyO3-Wrapper für Python.

**Python-Orchestrierung** — FastAPI, SQLAlchemy 2.0, Pydantic v2, Celery. LLM-Aufrufe, DB-Zugriffe, Connector-Management.

**Frontend** — React + TypeScript, Vite + Tailwind. Dunkles NOC-Theme, PWA-tauglich.

**Datenbank** — Postgres + pgvector. Claims als strukturierte Fakten, Episoden als chronologisches Archiv, Vektor-Index für semantische Suche.

## Kernkonzepte

Detaillierte Spezifikation: [`docs/OZY_ZUSAMMENFASSUNG_v5_2026-04-03.md`](docs/OZY_ZUSAMMENFASSUNG_v5_2026-04-03.md)

**Memory als Claims** — Strukturierte Fakten mit Verification State, Confidence, Sensitivity und Audit-Trail. Vier Schichten: Arbeitsgedächtnis, Episodisch, Semantisch, Prozedural.

**Memory v2 — Authority Lanes** — Claims werden in Lanes geführt (`identity`, `preference`, `evidence`, `authorization`, `procedural`) mit eigener Source-Trust-Write-Policy, TTL/Decay und single-valued-Konfliktauflösung. Dazu query-aware Recall (deutsche FTS + Synonyme, Pro-Lane-Budgets), Recall-Snippets, eine Entity-Relations-Schicht und selbstgeschriebene Verhaltensregeln mit Pflicht-Review (Guardian-Approval) und deterministischer Konflikterkennung.

**5 Write-Gates** — Schema-Validierung → Source Provenance → Conflict Detection → Human-in-the-Loop → Append-Only Commit. Kein LLM schreibt direkt in die DB.

**Sensitivity-Routing** — S0 (öffentlich) bis S4 (intimate). Der Sensitivity Router entscheidet pro Claim, welcher Provider ihn sehen darf. S4 läuft ausschließlich lokal, S3 lokal-bevorzugt. Fällt der lokale Classifier aus, degradiert das System nachvollziehbar (mit Provenance) statt hart fail-closed — der Chat bleibt nutzbar. → [`docs/OZY_CONTRACTS_SPEC_v1_2026-04-03.md`](docs/OZY_CONTRACTS_SPEC_v1_2026-04-03.md)

**5 Approval-Klassen** — Klasse 0 (Read) bis Klasse 4 (Destructive, High-Friction). Das System stuft immer nach oben, nie nach unten.

**Provider-Routing** — DeepSeek, Gemini, OpenAI, lokale Modelle (Ollama/LM Studio). Routing nach Taskklasse, Risiko, Datenschutz, Latenz und Kosten, mit resilientem Fallback bei nicht erreichbaren lokalen Providern.

**Live-Web** — Optionaler Web-Zugriff: provider-nativ zuerst, alternativ über einen konfigurierbaren Connector. S3-Zugriffe erfordern explizite Bestätigung.

**Voice** — End-to-end Sprach-Flow (STT/TTS) mit Push-to-Talk und Freisprech-Modus.

## Tech Stack

| Komponente | Technologie |
|---|---|
| Validierung & Governance | Rust |
| Orchestrierung & API | Python, FastAPI |
| Datenbank | Postgres + pgvector |
| Hintergrund-Jobs | Celery |
| Frontend | React, TypeScript, Vite, Tailwind |
| Deployment | Docker, Nginx Reverse Proxy |
| LLM-Provider | DeepSeek, Gemini, OpenAI, Ollama/LM Studio |

## Projektstruktur

```
ozymandias/
├── rust/                        # Rust-Workspace
│   ├── ozy-contracts/           # Typen, Enums, Error-Types (kein Verhalten)
│   ├── ozy-core/                # Sensitivity Router, Write-Gates, PolicyResolver
│   └── ozy-bindings/            # PyO3-Wrapper — Rust → Python Bridge
├── backend/                     # Python/FastAPI
│   ├── app/
│   │   ├── api/                 # Route-Handler (FastAPI Routers)
│   │   ├── memory/              # Memory v2: Lanes, Retrieval, Regeln (reine, I/O-freie Logik)
│   │   ├── models/              # SQLAlchemy-Modelle
│   │   ├── schemas/             # Pydantic-Schemas
│   │   └── services/            # Business-Logik, LLM-Aufrufe
│   ├── alembic/                 # DB-Migrationen
│   └── tests/                   # Pytest-Suites
├── frontend/                    # React Dashboard (Vite + Tailwind)
│   └── src/
├── docs/                        # Specs, DB-Schema, Versionsmatrix, Strategie
├── nginx/                       # Nginx-Konfiguration (Reverse Proxy)
└── .github/workflows/           # CI/CD (PR Gate, Nightly, Release)
```

## Status

| Modul | Status | Beschreibung |
|---|---|---|
| `ozy-contracts` | ✅ Fertig | Typen, Enums, Error-Types implementiert und validiert |
| `ozy-core` | ✅ Fertig | Sensitivity Router, Write-Gates, PolicyResolver, Circuit Breaker, Taint Tracker, Decay Engine, Token Budget |
| `ozy-bindings` | ✅ Fertig | PyO3-Bridge implementiert, Fallback-Modus vorhanden |
| `backend` | ✅ Fertig | FastAPI, Claims/Memory inkl. Memory v2 (Authority Lanes), Proposals, Audit, Voice (STT/TTS), Mail/Kalender, Kontakte, Projekte, Live-Web, Provider-Routing, Celery, Auth |
| `frontend` | ✅ Fertig | React-Dashboard (NOC-Theme): Chat, Settings, Voice, Memory-/Regel-Review, System-Health, Proposals, Audit |
| Deployment | 🚧 In Arbeit | Docker Compose + Nginx vorhanden; Public-Deployment-Härtung und Mobile-Distribution sind noch Roadmap-Themen |

Aktuelle Phase: **Phase 2 — Memory v2 & Autonomy**

## Entwicklung

```bash
# Rust: Format, Lint, Tests
cd rust
cargo fmt
cargo clippy --all-targets -- -D warnings
cargo test --workspace

# Python: Lint, Typecheck, Tests
cd backend
python -m ruff check app tests
python -m ruff format app tests
python -m mypy --config-file pyproject.toml app tests
python -m pytest -q tests/

# Frontend: Dev-Server
cd frontend
npm install
npm run dev
```

CI läuft bei jedem PR automatisch (PR Gate): Rust-Tests, Python-Lint/Typen/Tests, DB-Migration-Sanity, Bindings-Smoke, Security-Scan.

### Devcontainer

Das Repo enthält eine `.devcontainer/devcontainer.json` mit Rust, Python, Node.js und Docker-in-Docker. In VS Code/Cursor kann der Workspace über **Reopen in Container** gestartet werden; Auth-Bypass bleibt auch dort standardmäßig deaktiviert.

## Lizenz

[Apache License 2.0](LICENSE)
