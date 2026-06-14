# Ozymandias Requirements (Gesamt)

Diese Datei ist die zentrale Startseite fuer alle Anforderungen im Projekt.

## Wofuer brauche ich was?

| Modus | Voraussetzungen |
|---|---|
| **System ausführen (Standard)** | Nur Docker Engine (oder Podman) |
| Lokale IDE-Entwicklung (Rust Core) | Rust Toolchain (`rustc`, `cargo` >= 1.94) |
| Lokale IDE-Entwicklung (Backend) | Python >= 3.14 + pip-Abhängigkeiten |
| Lokale IDE-Entwicklung (Frontend) | Node.js LTS >= 24 |

## Containerisierte Software (Automatisch im Docker-Build)

Diese Versionen werden im Docker-Build verwendet und sind im System fest verankert:

| Bereich | Software / Paket | Version |
|---|---|---|
| Rust | Rust compiler / Edition | 1.94+ / 2024 |
| Python | Python runtime | 3.14-slim |
| Frontend | Node.js (Build-Stage) | 22-alpine |
| Datenbank | PostgreSQL | 17 (pgvector Image) |
| Vektor | pgvector | pg17 extension |
| Proxy | Nginx | 1.28-alpine |

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
