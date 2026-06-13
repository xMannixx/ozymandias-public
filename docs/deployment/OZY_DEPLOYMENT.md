# OZY Deployment-Guide

> Infrastruktur-Übersicht: `docker-compose.yaml`  
> Nginx-Konfiguration: `nginx/default.conf`  
> Umgebungsvariablen-Template: `frontend/.env.example`  
> Versionsziele: `REQUIREMENTS.md`, `docs/OZY_SOFTWARE_VERSIONEN.md`

---

## Inhaltsverzeichnis

- [Voraussetzungen](#voraussetzungen)
- [Lokale Entwicklung](#lokale-entwicklung)
- [Docker-Compose Produktionsstart](#docker-compose-produktionsstart)
- [Umgebungsvariablen (Vollständige Referenz)](#umgebungsvariablen)
- [Services und Ports](#services-und-ports)
- [Datenbank-Initialisierung](#datenbank-initialisierung)
- [Nginx und Reverse Proxy](#nginx-und-reverse-proxy)
- [VPS-Deployment](#vps-deployment)
- [SSL/TLS mit HTTPS](#ssltls-mit-https)
- [Produktions-Sicherheitscheckliste](#produktions-sicherheitscheckliste)
- [Wichtige Warnungen](#wichtige-warnungen)

---

## Voraussetzungen

| Software | Mindestversion | Zielversion |
|---|---|---|
| Docker Engine | 25+ | 29.3.1 |
| Docker Compose | 2.20+ | v2 (integriert in Docker) |
| Rust Toolchain | 1.85+ | 1.94.1 |
| Python | 3.12+ | 3.14.2 |
| Node.js | 20+ | 24.14.1 LTS |

Vollständige Versionsmatrix: [`docs/OZY_SOFTWARE_VERSIONEN.md`](OZY_SOFTWARE_VERSIONEN.md)

---

## Lokale Entwicklung

### Nur Infrastruktur (Postgres + Redis + MinIO) hochfahren

```bash
# Nur Datenbankdienste starten (für lokale Backend-Entwicklung)
docker compose up postgres redis minio -d
```

### Rust-Workspace bauen

```bash
cd rust
cargo build --workspace
cargo test --workspace
```

### Python-Backend lokal starten

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt

# Rust-Bindings für lokale Entwicklung (falls nicht gebaut)
# Ohne Bindings: AUTH_DEV_BYPASS=true aktiviert Fallback-Modus
export AUTH_DEV_BYPASS=true
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/ozymandias"
export REDIS_URL="redis://localhost:6379/0"

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend-Dev-Server starten

```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

---

## Docker-Compose Produktionsstart

### Alle Services starten

```bash
# 1. .env-Datei aus Template erstellen und ausfüllen
cp frontend/.env.example .env
# .env bearbeiten — ALLE Secrets setzen!

# 2. Vollständig bauen und starten
docker compose up --build -d

# 3. Logs prüfen
docker compose logs -f backend
docker compose logs -f db-init
```

### Status prüfen

```bash
docker compose ps

# Health-Endpunkt testen
curl http://localhost:8080/health
```

Erwartete Antwort:
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "rust_bindings": "ok",
  "llm_providers": ["deepseek", "ollama"]
}
```

### Services stoppen

```bash
# Services stoppen, Daten BEHALTEN
docker compose down

# ⚠️ NIEMALS in Produktion: Löscht alle Daten (Postgres-Volume enthält alle Claims/Memory)
# docker compose down -v
```

---

## Umgebungsvariablen

Erstelle eine `.env`-Datei im Root-Verzeichnis. Alle Variablen werden von `backend/app/config.py` geladen.

### Datenbank & Infrastruktur

```env
# PostgreSQL Connection
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/ozymandias

# Redis (Circuit Breaker, OAuth State)
REDIS_URL=redis://redis:6379/0

# MinIO (Datei-Uploads, Kontakt-Avatare)
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=DEIN_MINIO_USER           # Ändern!
MINIO_SECRET_KEY=DEIN_MINIO_SECRET         # Ändern! Min. 16 Zeichen
MINIO_BUCKET=ozy-files
MINIO_SECURE=false                         # true für HTTPS-MinIO
```

### Authentifizierung

```env
# JWT Secret — MUSS in Produktion geändert werden!
JWT_SECRET=ZUFAELLIGER_64_ZEICHEN_STRING   # z.B.: openssl rand -hex 32
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# Entwicklungs-Bypass — NIEMALS in Produktion!
AUTH_DEV_BYPASS=false

# CORS (kommagetrennt, keine Leerzeichen)
CORS_ORIGINS=http://localhost:8080,https://deine-domain.tld
```

### Google OAuth (Gmail + Calendar Connector)

```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REDIRECT_URI=https://deine-domain.tld/auth/google/callback
OWNER_EMAIL=deine@email.de
```

### LLM-Provider

```env
# DeepSeek (Default Work/Extraktion)
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# OpenAI (Tool-Calls, TTS, Whisper)
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o
WHISPER_MODEL=whisper-1
TTS_MODEL=tts-1
TTS_VOICE=alloy

# Gemini (Talk, Kreativität)
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.0-flash

# Ollama (Lokal, S3/S4 — läuft auf dem Host)
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1:8b

# LM Studio (Alternative zu Ollama, optional)
LMSTUDIO_BASE_URL=http://host.docker.internal:1234/v1
LMSTUDIO_MODEL=                            # Leer lassen wenn nicht verwendet
```

### Circuit Breaker

```env
CB_MAX_ACTIONS=20          # Max Aktionen pro Fenster
CB_WINDOW_SECONDS=60       # Zeitfenster in Sekunden
CB_COOLDOWN_SECONDS=120    # Cooldown nach Trip
```

---

## Services und Ports

| Service | Container | Port (intern) | Port (extern) | Zweck |
|---|---|---|---|---|
| PostgreSQL | `ozy-postgres` | 5432 | 5432 | Hauptdatenbank |
| Redis | `ozy-redis` | 6379 | 6379 | Circuit Breaker, OAuth State |
| MinIO | `ozy-minio` | 9000/9001 | 9000/9001 | Datei-Speicher |
| Backend (FastAPI) | `ozy-backend` | 8000 | 8000 | REST API |
| Frontend (Build) | `ozy-frontend-build` | — | — | Nur Build, kein Server |
| Nginx | `ozy-nginx` | 80 | **8080** | Reverse Proxy + SPA |
| DB-Init | `ozy-db-init` | — | — | Einmalige Schema-Initialisierung |
| PG-Backup | `ozy-pg-backup` | — | — | Tägliche Backups |

**Hauptzugangspunkt:** `http://localhost:8080` (Nginx)

**In Produktion:** Ports 5432, 6379, 9000/9001 sollten **nicht** öffentlich erreichbar sein — nur im internen Docker-Netz.

---

## Datenbank-Initialisierung

Die Datenbankinitialisierung erfolgt automatisch beim ersten Start über den `db-init`-Container:

```yaml
# docker-compose.yaml (db-init Service)
command: >
  sh -c "
  psql -h postgres -U postgres -d ozymandias -c 'CREATE EXTENSION IF NOT EXISTS vector;';
  psql -h postgres -U postgres -d ozymandias -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;';
  psql -h postgres -U postgres -d ozymandias -f /schema.sql
  "
```

Das vollständige Schema liegt in `docs/spec/OZY_DB_Schema.sql`.

### Alembic-Migrationen (Backend-Entwicklung)

```bash
cd backend

# Neue Migration erstellen
alembic revision --autogenerate -m "beschreibung"

# Migrationen anwenden
alembic upgrade head

# Migrationsstatus prüfen
alembic current
alembic history
```

---

## Nginx und Reverse Proxy

Nginx (`nginx/default.conf`) dient als:
1. **SPA-Server**: Liefert das React-Frontend aus (`/usr/share/nginx/html`)
2. **API-Proxy**: Leitet API-Anfragen an das Backend weiter
3. **Path-Disambiguierung**: Bestimmte Pfade werden per `sec-fetch-mode` unterschieden (Browser-Navigation → SPA, API-Calls → Backend)

### Upload-Größe

```nginx
client_max_body_size 520m;  # Erlaubt große Screen-Recordings
```

Das Backend selbst hat ebenfalls ein 512 MB Limit für File-Uploads.

### API-Endpunkte (Proxy-Regeln)

Folgende Pfade werden an das Backend weitergeleitet:
```
/health, /claims, /proposals, /turns, /voice, /auth,
/audit, /stats, /mail, /calendar, /files, /llm,
/settings, /settings/*, /projects, /projects/*,
/contacts, /contacts/*
```

Alle anderen Pfade → `index.html` (React SPA-Routing).

---

## VPS-Deployment

### Empfohlene Konfiguration

- **VPS**: 2 vCPU, 4 GB RAM minimum (8 GB empfohlen bei lokalen LLM-Modellen)
- **Storage**: 20 GB für OS + Docker Images, zusätzlich für Postgres-Daten und Backups
- **OS**: Ubuntu 24.04 LTS

### Schritte

```bash
# 1. Repository klonen
git clone https://github.com/xMannixx/ozymandias-public.git
cd ozymandias-public

# 2. .env erstellen und konfigurieren
cp frontend/.env.example .env
nano .env  # Alle Secrets setzen

# 3. Docker installieren (falls noch nicht vorhanden)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 4. Starten
docker compose up --build -d

# 5. Logs prüfen
docker compose logs -f --tail=50
```

### Lokaler LLM-Provider (Ollama auf VPS)

Ollama auf dem Host-System laufen lassen:
```bash
# Ollama installieren
curl -fsSL https://ollama.ai/install.sh | sh

# Modell laden
ollama pull llama3.1:8b

# .env: Backend zeigt auf Host
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

---

## SSL/TLS mit HTTPS

Die aktuelle Nginx-Konfiguration läuft auf HTTP (Port 80). Für HTTPS:

### Option 1: Nginx auf VPS mit Let's Encrypt (Certbot)

```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx

# Zertifikat beantragen
sudo certbot --nginx -d deine-domain.tld

# nginx/default.conf anpassen: listen 443 ssl + Zertifikatspfade
```

### Option 2: Reverse Proxy vor Docker (Traefik/Caddy)

Für einen vollständig containerisierten Ansatz empfiehlt sich Traefik oder Caddy als vorgelagerter Reverse Proxy mit automatischem Let's Encrypt.

### Nach HTTPS-Aktivierung

```env
# .env anpassen
GOOGLE_REDIRECT_URI=https://deine-domain.tld/auth/google/callback
CORS_ORIGINS=https://deine-domain.tld
```

---

## Produktions-Sicherheitscheckliste

- [ ] `JWT_SECRET` auf zufälliges 64-Zeichen-Secret gesetzt (`openssl rand -hex 32`)
- [ ] `AUTH_DEV_BYPASS=false` (oder nicht gesetzt)
- [ ] `MINIO_SECRET_KEY` geändert (kein Default-Wert)
- [ ] `POSTGRES_PASSWORD` in docker-compose.yaml geändert
- [ ] Ports 5432, 6379, 9000/9001 **nicht** öffentlich (Firewall/UFW)
- [ ] HTTPS aktiviert (Let's Encrypt oder ähnlich)
- [ ] `CORS_ORIGINS` auf tatsächliche Domain beschränkt
- [ ] Postgres-Backup-Container läuft (`pg-backup` in docker compose ps)
- [ ] Audit-Log wird regelmäßig geprüft (siehe `OZY_MONITORING.md`)
- [ ] Regelmäßige Off-Site-Backups eingerichtet (siehe `OZY_BACKUP_RESTORE.md`)

---

## Wichtige Warnungen

> ⚠️ **CRITICAL**: `docker compose down -v` löscht alle Docker-Volumes — darunter das PostgreSQL-Datenvolumen mit **allen Claims, Memory und Audit-Logs**. Niemals in Produktion verwenden, ohne vorherigen Backup.

> ⚠️ **CRITICAL**: `AUTH_DEV_BYPASS=true` deaktiviert die JWT-Authentifizierung vollständig. Alle API-Endpunkte sind ohne Token erreichbar. Nur für lokale Entwicklung.

> ⚠️ **IMPORTANT**: Das `postgres_data`-Volume ist kommentiert: `# NIEMALS mit docker-compose down -v loeschen — enthaelt alle Claims/Memory`. Diese Warnung ist ernst gemeint.
