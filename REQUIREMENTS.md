# Ozymandias Requirements (Gesamt)

Diese Datei ist die zentrale Startseite fuer alle Anforderungen im Projekt.

## Wofuer brauche ich was?

| Modus | Pflicht |
|---|---|
| Rust-Core Entwicklung (`rust/`) | Rust Toolchain (`rustc`, `cargo`) |
| Backend Entwicklung (`backend/`) | Rust + Python + `backend/requirements.txt` |
| Full Stack (Backend + Frontend + Infra) | Rust + Python + Node.js + Docker + Postgres/pgvector + Nginx |

## Pflicht-Software (Projektweit)

| Bereich | Software | Zielstand |
|---|---|---|
| Rust | rustc | 1.94.1 |
| Rust | cargo | 1.94.1 |
| Rust | Edition | 2024 |
| Python | Python | 3.14.2 |
| Python API | FastAPI, Pydantic, SQLAlchemy, Celery, Alembic, Uvicorn, asyncpg, PyJWT | siehe `backend/requirements.txt` |
| Frontend | Node.js LTS | 24.14.1 |
| Frontend | React, TypeScript, Vite, Tailwind | siehe `docs/OZY_SOFTWARE_VERSIONEN.md` |
| Datenbank | PostgreSQL | 18.3 |
| Vektor | pgvector | 0.8.2 |
| Proxy | Nginx | 1.28.3 stable |
| Container | Docker Engine | 29.3.1 |

## Source of Truth pro Stack

| Thema | Source of Truth |
|---|---|
| Rust Dependencies | `rust/Cargo.toml`, `rust/Cargo.lock` |
| Python Dependencies (Backend) | `backend/requirements.txt` |
| Ziel-Versionen gesamt | `docs/OZY_SOFTWARE_VERSIONEN.md` |
| Architektur/Spezifikation | `docs/OZY_ZUSAMMENFASSUNG_v5_2026-04-03.md` |

## Verifikation (kurz)

```powershell
rustc --version
cargo --version
python --version
docker --version
docker compose version
```

Backend-Pakete anzeigen:

```powershell
python -m pip freeze
```
