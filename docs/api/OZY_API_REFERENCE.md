# OZY API-Referenz

> Basis-URL: `http://localhost:8000` (Dev) / `http://localhost:8080` (über Nginx)  
> OpenAPI/Swagger: `http://localhost:8000/docs`  
> ReDoc: `http://localhost:8000/redoc`  
> Implementierung: `backend/app/api/`, `backend/app/main.py`

---

## Authentifizierung

Alle Endpunkte außer `/health`, `/auth/google/url`, `/auth/google/callback` erfordern einen **JWT Bearer Token** im `Authorization`-Header:

```
Authorization: Bearer <jwt-token>
```

### Dev-Bypass

Wenn `AUTH_DEV_BYPASS=true` gesetzt ist, wird ein fixer Dev-User (`user_id = "dev-user"`) ohne Token-Prüfung verwendet. **Nur für lokale Entwicklung.**

---

## Endpunkt-Übersicht

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/health` | System-Gesundheitsstatus |
| POST | `/turns` | Turn verarbeiten (Haupt-KI-Endpunkt) |
| GET | `/claims` | Claims auflisten |
| POST | `/claims` | Claim direkt erstellen |
| GET | `/claims/{id}` | Claim abrufen |
| PATCH | `/claims/{id}/confirm` | Claim bestätigen |
| PATCH | `/claims/{id}/retract` | Claim zurückziehen |
| PATCH | `/claims/{id}/archive` | Claim archivieren |
| PATCH | `/claims/{id}/lock` | Claim sperren |
| PATCH | `/claims/{id}/unlock` | Claim entsperren |
| PATCH | `/claims/{id}/sensitivity` | Sensitivity ändern |
| GET | `/claims/{id}/versions` | Claim-Versionshistorie |
| GET | `/proposals` | Proposals auflisten |
| POST | `/proposals/{id}/approve` | Proposal genehmigen |
| POST | `/proposals/{id}/reject` | Proposal ablehnen |
| GET | `/audit` | Audit-Log abrufen |
| GET | `/stats` | System-Statistiken |
| GET | `/settings` | Nutzereinstellungen abrufen |
| PUT | `/settings` | Nutzereinstellungen aktualisieren |
| GET | `/auth/google/url` | Google OAuth URL erzeugen |
| GET | `/auth/google/callback` | Google OAuth Callback |
| GET | `/auth/google/status` | Google-Verbindungsstatus |
| POST | `/auth/google/disconnect` | Google-Verbindung trennen |
| GET | `/mail` | Mails abrufen |
| GET | `/calendar/events` | Kalender-Events abrufen |
| POST | `/calendar/events` | Kalender-Event erstellen |
| GET | `/projects` | Projekte auflisten |
| POST | `/projects` | Projekt erstellen |
| GET | `/projects/{id}` | Projekt abrufen |
| PUT | `/projects/{id}` | Projekt aktualisieren |
| DELETE | `/projects/{id}` | Projekt löschen |
| GET | `/contacts` | Kontakte auflisten |
| POST | `/contacts` | Kontakt erstellen |
| GET | `/files` | Dateien auflisten |
| POST | `/files/upload` | Datei hochladen |
| GET | `/llm/providers` | Konfigurierte Provider |
| GET | `/llm/{provider}/models` | Wählbare Modelle eines Providers |
| POST | `/voice/transcribe` | Sprachaufnahme transkribieren |
| POST | `/voice/synthesize` | Text zu Sprache |
| POST | `/memory/facts` | Fakt lane- und policy-bewusst schreiben |
| POST | `/memory/recall` | Query-aware Recall (Lanes, Budgets) |
| POST/GET | `/memory/snippets` | Recall-Snippets hinzufügen/auflisten |
| POST/GET | `/memory/entities` | Entitäten upserten/auflisten |
| POST/GET | `/memory/relations` | Entity-Relationen hinzufügen/auflisten |
| GET | `/memory/rules` | Verhaltensregeln auflisten |
| POST | `/memory/rules/propose` | Regel vorschlagen (Review-Gate) |
| POST | `/memory/rules/{id}/approve` | Regel freigeben (Guardian) |
| POST | `/memory/rules/{id}/reject` | Regel ablehnen |
| POST | `/memory/rules/{id}/retire` | Regel zurückziehen |
| GET | `/memory/rules/conflicts` | Regel-Konflikte auflisten |
| GET | `/memory/provenance/{target_id}` | Provenance/Historie rekonstruieren |
| GET | `/memory/stats` | Memory-Kennzahlen |
| GET | `/memory/snapshot` | Strukturierten Memory-Snapshot exportieren |

---

## Detaillierte Endpunkte

### GET `/health`

Keine Authentifizierung erforderlich.

**Response:**
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "rust_bindings": "ok",
  "llm_providers": ["deepseek", "ollama"],
  "llm_provider_health": [
    { "name": "ollama", "is_local": true, "configured": true, "status": "ok", "model": "llama3.1:8b" }
  ],
  "live_web": { "connector_status": "not_configured", "native_provider_candidates": ["openai"] }
}
```

**Status-Werte:**
- `database`: `"ok"` | `"error"`
- `redis`: `"ok"` | `"unavailable"`
- `rust_bindings`: `"ok"` | `"dev-fallback"` | `"unavailable"` | Exception
  - Im Dev-Bypass bedeutet `dev-fallback`: Das Modul fehlt vollständig. Eine vorhandene, aber nicht ladbare Bibliothek wird als `unavailable` gemeldet; die Bridge reicht den Importfehler weiter. Ohne Dev-Bypass werden Importfehler weiterhin ausgelöst.
- `llm_provider_health[].status`: `"ok"` | `"unavailable"` | `"configured"` | `"not_configured"`
- `live_web.connector_status`: `"configured"` | `"not_configured"` | `"unavailable"`
- `llm_providers`: Liste der konfigurierten Provider-Namen

---

### POST `/turns`

Haupt-Endpunkt für KI-Konversation. Verarbeitet einen vollständigen Turn inklusive Context Assembly, LLM-Routing, Claim-Extraktion und Write-Gate-Pipeline.

**Request:**
```json
{
  "message": "string",
  "intent": "work",
  "conversation_id": "uuid (optional)",
  "preferred_provider": "deepseek (optional)",
  "preferred_model": "deepseek-v4-flash (optional)",
  "preferred_local_provider": "ollama (optional)",
  "preferred_local_model": "llama3.1:8b (optional)"
}
```

**Intent-Werte:** `work` | `talk` | `creative` | `tool_call` | `critical_action` | `claim_extraction` | `intimate_reflection` | *(beliebiger String)*

**Response:**
```json
{
  "reply": "string",
  "model": "deepseek-v4-flash",
  "provider": "deepseek",
  "tokens_used": 1234,
  "sensitivity": "S0",
  "claims_extracted": [
    {
      "proposal_id": "uuid",
      "status": "pending",
      "proposed_claim": { ... }
    }
  ],
  "circuit_breaker_status": "ok"
}
```

**Fehler:**
- `429 Too Many Requests`: Circuit Breaker ausgelöst
- `423 Locked`: Allgemeiner Service-Fehler (z.B. kein Provider konfiguriert)

---

### GET `/claims`

**Query-Parameter:**
- `subject: string` (optional) — Filtert nach Subject
- `sensitivity: S0|S1|S2|S3|S4` (optional) — Filtert nach Sensitivity

**Response:** Array von `ClaimResponse`

```json
[
  {
    "claim_id": "uuid",
    "user_id": "uuid",
    "subject": "alex",
    "attribute": "wohnort",
    "value": "Beispielstadt",
    "content": "Alex wohnt in Beispielstadt.",
    "memory_type": "profile",
    "verification_state": "confirmed",
    "confidence": 0.95,
    "source_ref": "turn-uuid",
    "source_type": "user_explicit",
    "sensitivity": "S0",
    "trust_level": "T3",
    "handling_policy": "cloud_ok_encrypted",
    "user_locked": false,
    "decay_eligible": true,
    "lifecycle": "permanent",
    "valid_from": "2019-10-01T00:00:00Z",
    "valid_to": null,
    "ingested_at": "2026-04-03T10:00:00Z",
    "superseded_at": null,
    "review_due": false,
    "last_reviewed": null,
    "last_accessed": "2026-04-06T12:00:00Z",
    "created_at": "2026-04-03T10:00:00Z",
    "updated_at": "2026-04-03T10:00:00Z"
  }
]
```

---

### POST `/claims`

Erstellt einen Claim direkt (ohne Proposal-Workflow). Für Imports und Admin-Operationen.

**Request:**
```json
{
  "claim": {
    "subject": "alex",
    "attribute": "wohnort",
    "value": "Beispielstadt",
    "content": "Alex wohnt in Beispielstadt.",
    "memory_type": "profile",
    "sensitivity": "S0",
    "trust_level": "T3",
    "handling_policy": "cloud_ok_encrypted",
    "verification_state": "confirmed",
    "confidence": 0.9,
    "source_type": "user_explicit",
    "user_locked": false,
    "decay_eligible": true,
    "lifecycle": "permanent"
  }
}
```

**Response:** `ClaimResponse` (201 Created)

---

### PATCH `/claims/{claim_id}/confirm`

Bestätigt einen tentative Claim.

**Response:** `ClaimResponse` mit `verification_state: "confirmed"`

**Fehler:**
- `404`: Claim nicht gefunden
- `409`: Claim ist bereits confirmed/superseded/retracted

---

### GET `/proposals`

**Query-Parameter:**
- `status: pending|confirmed|rejected|auto_confirmed` (optional)

**Response:**
```json
[
  {
    "proposal_id": "uuid",
    "user_id": "uuid",
    "proposed_claim": { ... },
    "source_ref": "turn-uuid",
    "source_type": "model_inferred",
    "status": "pending",
    "conflict_group_id": null,
    "rejection_reason": null,
    "created_at": "2026-04-06T12:00:00Z",
    "decided_at": null,
    "decided_by": null
  }
]
```

---

### POST `/proposals/{proposal_id}/approve`

**Response:** Das aktualisierte Proposal (status: "confirmed") + ausgelöster Claim-Create

---

### POST `/proposals/{proposal_id}/reject`

**Request:**
```json
{
  "reason": "Dieser Fakt ist falsch."
}
```

**Response:** Das aktualisierte Proposal (status: "rejected")

---

### GET `/audit`

**Query-Parameter:**
- `event_type: string` (optional)
- `sensitivity: S0|S1|S2|S3|S4` (optional)
- `result: success|failed|blocked|rolled_back` (optional)
- `after: ISO-8601 datetime` (optional)
- `before: ISO-8601 datetime` (optional)
- `limit: int` (Standard: 50, Max: 200)
- `offset: int` (Standard: 0)
- `include_s4: bool` (Standard: false — S4-Einträge standardmäßig ausgeblendet)

**Response:**
```json
{
  "entries": [
    {
      "audit_id": "uuid",
      "event_type": "memory_confirmed",
      "user_id": "uuid",
      "channel": "web",
      "payload": { ... },
      "source_ref": "proposal-uuid",
      "result": "success",
      "sensitivity": "S0",
      "created_at": "2026-04-06T12:00:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

---

### GET `/settings` / PUT `/settings`

**Response-Schema:**
```json
{
  "mode": "guardian",
  "kill_switch": false,
  "decay_interval_hours": 24,
  "decay_confidence_threshold": 0.1,
  "cb_max_actions_override": null,
  "cb_window_seconds_override": null,
  "cb_cooldown_seconds_override": null,
  "preferred_provider": "deepseek",
  "preferred_model": "deepseek-v4-flash",
  "preferred_local_provider": "ollama",
  "preferred_local_model": "llama3.1:8b",
  "voice_enabled": false,
  "voice_mode": "push_to_talk",
  "tts_voice": "ash",
  "tts_model": "tts-1",
  "tts_autoplay": true
}
```

**Mode-Werte:** `"guardian"` (HITL für alles) | `"autopilot"` (automatisch mit Undo-Window)

---

### POST `/voice/transcribe`

**Content-Type:** `multipart/form-data`

**Felder:**
- `file`: Audio-Datei (WAV, MP3, WebM, etc.)

**Response:**
```json
{
  "text": "Transkribierter Text"
}
```

---

### POST `/voice/synthesize`

**Request:**
```json
{
  "text": "Text der gesprochen werden soll",
  "voice": "ash",
  "model": "tts-1"
}
```

**Response:** `audio/mpeg` Binärdaten (direkt abspielen oder herunterladen)

---

## Fehler-Antworten

Alle Fehler folgen dem FastAPI-Standard:

```json
{
  "detail": "Fehlermeldung als String oder Objekt"
}
```

| HTTP-Code | Bedeutung |
|---|---|
| `400 Bad Request` | Ungültige Eingabe |
| `401 Unauthorized` | Kein oder ungültiger JWT |
| `403 Forbidden` | Keine Berechtigung (z.B. Google OAuth Scope fehlt) |
| `404 Not Found` | Ressource nicht gefunden |
| `409 Conflict` | Zustandskonflikt (z.B. Proposal nicht mehr pending) |
| `422 Unprocessable Entity` | Pydantic-Validierungsfehler |
| `423 Locked` | Service-Fehler (z.B. kein LLM-Provider konfiguriert) |
| `429 Too Many Requests` | Circuit Breaker ausgelöst |
| `500 Internal Server Error` | Unerwarteter Fehler |
