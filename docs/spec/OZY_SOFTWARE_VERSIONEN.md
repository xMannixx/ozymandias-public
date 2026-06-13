# Ozymandias — Software-Versionen (v4)

Stand: 11.04.2026

Regel: Nur neueste stabile Versionen, keine Betas.

## Legende

- `Ist`: aktuell verifiziert (Repo oder lokal)
- `Ziel`: gewünschter Zielstand laut Projektregel
- `Status`:
  - `OK` = Ist entspricht Ziel/Policy
  - `TO_FIX` = bekannter Drift, aktiv zu beheben
  - `PLANNED` = geplant/recherchiert, aber nicht im Repo verankert

## A) Verifiziert im Repo (Source of Truth)

### Rust-Workspace (`rust/Cargo.toml`, `rust/Cargo.lock`)

| Komponente | Ist (verifiziert) | Ziel | Status | Evidenz |
|---|---|---|---|---|
| `ozy-contracts` edition | `2024` | `2024` | `OK` | `rust/ozy-contracts/Cargo.toml` |
| `ozy-core` edition | `2024` | `2024` | `OK` | `rust/ozy-core/Cargo.toml` |
| `serde` | `1.0.228` | latest stable 1.x | `OK` | `rust/Cargo.lock` |
| `serde_json` | `1.0.149` | latest stable 1.x | `OK` | `rust/Cargo.lock` |
| `proptest` | `1.11.0` | latest stable 1.x | `OK` | `rust/Cargo.lock` |

### Python-Backend (`backend/requirements.txt`)

| Komponente | Ist (verifiziert) | Ziel | Status | Evidenz |
|---|---|---|---|---|
| FastAPI | `0.135.3` | latest stable | `OK` | `backend/requirements.txt` |
| Pydantic | `2.12.5` | latest stable 2.x | `OK` | `backend/requirements.txt` |
| pydantic-settings | `2.13.1` | latest stable 2.x | `OK` | `backend/requirements.txt` |
| SQLAlchemy | `2.0.48` | latest stable 2.x | `OK` | `backend/requirements.txt` |
| Celery | `5.6.3` | latest stable 5.x | `OK` | `backend/requirements.txt` |
| Alembic | `1.18.4` | latest stable 1.x | `OK` | `backend/requirements.txt` |
| Uvicorn | `0.43.0` | latest stable | `OK` | `backend/requirements.txt` |
| asyncpg | `0.31.0` | latest stable | `OK` | `backend/requirements.txt` |
| PyJWT | `2.12.1` | latest stable 2.x | `OK` | `backend/requirements.txt` |
| redis[hiredis] | `6.4.0` | latest stable | `OK` | `backend/requirements.txt` |

### Frontend (`frontend/package.json`)

| Komponente | Ist (verifiziert) | Ziel | Status | Evidenz |
|---|---|---|---|---|
| React | `19.2.4` | latest stable 19.x | `OK` | `frontend/package.json` |
| React-DOM | `19.2.4` | latest stable 19.x | `OK` | `frontend/package.json` |
| TypeScript | `6.0.2` | latest stable 6.x | `OK` | `frontend/package.json` |
| Vite | `8.0.3` | latest stable | `OK` | `frontend/package.json` |
| Tailwind CSS | `4.2.2` | latest stable 4.x | `OK` | `frontend/package.json` |
| react-router-dom | `7.0.0` | latest stable 7.x | `OK` | `frontend/package.json` |
| Node.js (min) | `>=22` | LTS (22.x oder 24.x) | `OK` | `frontend/package.json` → `engines` |

### Infrastruktur (`docker-compose.yaml`)

| Komponente | Ist (verifiziert) | Ziel | Status | Evidenz |
|---|---|---|---|---|
| PostgreSQL | `17` (pgvector/pgvector:pg17) | latest stable (17.x) | `OK` | `docker-compose.yaml` |
| pgvector | im pg17-Image enthalten | latest für PG17 | `OK` | `docker-compose.yaml` |
| Redis | `7-alpine` | latest stable 7.x | `OK` | `docker-compose.yaml` |
| Nginx | `1.28-alpine` | latest stable 1.28.x | `OK` | `docker-compose.yaml` |
| MinIO | `latest` | latest stable | `OK` | `docker-compose.yaml` |

## B) Lokal verifiziert (Runtime/Toolchain)

| Komponente | Ist (verifiziert) | Ziel | Status | Evidenz |
|---|---|---|---|---|
| `rustc` | latest stable | latest stable | `OK` | lokaler CLI-Check |
| `cargo` | latest stable | latest stable | `OK` | lokaler CLI-Check |
| `python` | `3.12.x` oder neuer | latest stable 3.12+ | `OK` | lokaler CLI-Check |

## C) Nicht im Repo verankert (PLANNED)

| Bereich | Software | Ziel-Version | Status | Hinweis |
|---|---|---|---|---|
| Infra | Docker Engine | latest stable | `PLANNED` | Nur über Server-Setup steuerbar |

## D) LLM-Provider (Policy-Matrix, keine feste Semver)

| Provider/Stack | Verwendung |
|---|---|
| DeepSeek-V3 | Default/Work |
| Gemini | Talk/Kreativ |
| OpenAI GPT-4o/5 | Tool-Calls, kritische Aktionen |
| Ollama/LM Studio | Lokalbetrieb, S3/S4, Privacy |
| DeepSeek Batch | Nachtjobs |
| OpenAI Whisper | STT |
| OpenAI TTS | TTS |

## Offene Aktionen

1. Docker Engine Version im Deployment-Skript dokumentieren (`OZY_DEPLOYMENT.md`).
