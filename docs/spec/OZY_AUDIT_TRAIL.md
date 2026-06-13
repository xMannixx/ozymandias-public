# OZY Audit-Trail — Technische Spezifikation

> Implementiert in: `backend/app/services/audit_service.py`, `backend/app/api/audit.py`  
> Rust-Validierung: `rust/ozy-core/src/audit_validator.rs`  
> DB-Tabelle: `audit_log` (siehe `OZY_DB_Schema.sql`)  
> Typen: `AuditEntry`, `AuditEventType`, `AuditResult` in `ozy-contracts`

---

## Überblick

Der Audit-Trail ist ein **vollständiges, append-only, lückenloses Protokoll** aller sicherheitsrelevanten Aktionen im System. Er ist nicht optional — alle schreibenden Operationen im System erzeugen einen Audit-Log-Eintrag.

**Kernprinzipien:**
- **Append-Only**: Einträge können nicht gelöscht oder überschrieben werden
- **Vollständig**: Wer hat was angefragt, was wurde entschieden, was wurde ausgeführt
- **Zeitgestempelt**: UTC-Timestamp für jeden Eintrag
- **Sensitivity-gestuft**: S4-Einträge sind standardmäßig im Dashboard nicht sichtbar
- **Rust-validiert**: Jeder Eintrag wird vor dem DB-Schreiben durch die Rust-Kernel validiert

---

## Datenbankschema

```sql
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type  TEXT NOT NULL,   -- Ereignis-Typ
    user_id     UUID NOT NULL,   -- Betroffener Nutzer
    channel     TEXT NOT NULL,   -- web | telegram | system | celery
    payload     JSONB,           -- Event-spezifische Details
    source_ref  TEXT,            -- Referenz auf auslösendes Objekt
    result      TEXT,            -- success | failed | blocked | rolled_back
    sensitivity TEXT NOT NULL DEFAULT 'S0',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Wichtig:** `user_id` in `audit_log` ist UUID (normalisiert über `normalize_user_id()`), auch wenn der eingehende JWT einen String-Sub hat.

---

## Audit-Event-Typen

### Memory-Events

| Event-Typ | Auslöser | Wann geloggt |
|---|---|---|
| `memory_confirmed` | Nutzer bestätigt Proposal | `ProposalService.approve_proposal()` |
| `memory_rejected` | Nutzer lehnt Proposal ab | `ProposalService.reject_proposal()` |
| `memory_superseded` | G3 TemporalSuccession | `ClaimService.supersede_claim()` |
| `memory_retracted` | Nutzer löscht Claim | `ClaimService.retract_claim()` |

### Action-Events

| Event-Typ | Auslöser | Wann geloggt |
|---|---|---|
| `turn_processed` | LLM-Turn abgeschlossen | `TurnService.process_turn()` |
| `action_executed` | Service-Aktion erfolgreich | Verschiedene Services |
| `action_blocked` | Aktion blockiert (Policy/Gate) | Write-Gate-Fehler, Kill-Switch |
| `action_rolled_back` | Saga-Rollback (geplant) | Partial-Failure-Handling |

### Sicherheits-Events

| Event-Typ | Auslöser | Wann geloggt |
|---|---|---|
| `sensitivity_violation` | S3/S4 → Cloud-Provider versucht | Sensitivity Router |
| `circuit_breaker_tripped` | Circuit Breaker ausgelöst | `CircuitBreakerService.check()` |
| `payload_sensitivity_warning` | S4-Payload + Remote Write | Sensitivity Router |
| `taint_escalation` | Taint-Tracking erhöht Approval-Klasse | Taint Tracker |

---

## Audit-Entry-Struktur

Jeder Eintrag enthält:

```python
AuditEntry(
    event_type: AuditEventType,    # z.B. "memory_confirmed"
    result: AuditResult,           # "success" | "failed" | "blocked" | "rolled_back"
    actor: str,                    # z.B. "user:dev-user" | "service:claim_service"
    target_id: str,                # ID des betroffenen Objekts (Proposal-ID, Claim-ID)
    detail: str,                   # Menschenlesbare Beschreibung
    timestamp: str,                # ISO-8601 UTC
    sensitivity: Sensitivity,      # S0–S4 des betroffenen Inhalts
    channel: Channel,              # Eingangskanal
    payload: str | None,           # JSON-String mit event-spezifischen Details
    source_ref: str | None,        # Turn-ID, Batch-Job-ID, etc.
)
```

**`actor`-Konventionen:**
- `"user:<user_id>"` — Direkte Nutzeraktion
- `"service:<service_name>"` — Interner Service
- `"system"` — System-initiierte Aktion
- `"celery:<task_name>"` — Hintergrundjob

---

## Rust-Validierung

Bevor ein Audit-Eintrag in die DB geschrieben wird, validiert die Rust-Kernel die Struktur:

```python
# backend/app/services/audit_service.py
validation = rust_bridge.validate_audit_entry(entry)
if not isinstance(validation, str) or validation != "Valid":
    raise ValidationError(f"Invalid audit entry: {validation!r}")
```

Die Rust-Validierung prüft:
- Alle Pflichtfelder sind vorhanden
- `event_type` ist ein bekannter Wert
- `sensitivity` ist ein gültiger Wert (S0–S4)
- `timestamp` ist ein gültiges ISO-8601-Format
- `result` ist ein bekannter Wert

---

## API-Zugriff auf den Audit-Trail

### GET `/audit`

```bash
# Alle Events der letzten Stunde
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/audit?after=2026-04-06T11:00:00Z&limit=100"

# Nur blockierte Aktionen
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/audit?result=blocked"

# Nur Memory-Events
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/audit?event_type=memory_confirmed"

# S4-Einträge explizit anfordern (standardmäßig ausgeblendet)
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/audit?sensitivity=S4&include_s4=true"
```

**Pagination:**
```bash
# Erste Seite
curl ".../audit?limit=50&offset=0"

# Nächste Seite
curl ".../audit?limit=50&offset=50"
```

---

## Gestufte Sichtbarkeit (S4-Schutz)

S4-Audit-Einträge (Intimsphäre) erscheinen **standardmäßig nicht** im normalen Dashboard-Audit-Feed:

```python
# audit_service.py::list_entries()
elif exclude_s4:  # Standard: True
    filters.append(AuditLog.sensitivity != Sensitivity.S4.value)
```

Für S4-Einträge muss explizit `include_s4=true` als Query-Parameter gesetzt werden und der Nutzer muss sein S4-Passwort/Pin eingeben (geplant für spätere Phase).

**Begründung:** S4-Audit-Logs enthalten sensible Metadaten über Intimleben-bezogene Aktionen. Diese sollen nicht beim zufälligen Durchscrollen des Audit-Feeds sichtbar sein.

---

## Indizes für Performance

```sql
-- Suche nach Event-Typ und Zeitraum
CREATE INDEX idx_audit_event ON audit_log(event_type, created_at);

-- Alle Einträge eines Users
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at);

-- S3/S4 Einträge separat auffindbar
CREATE INDEX idx_audit_sensitivity
    ON audit_log(sensitivity)
    WHERE sensitivity IN ('S3', 'S4');
```

---

## Retention-Policy

Aktuell gibt es keine automatische Löschung von Audit-Log-Einträgen. Geplante Policy:

| Sensitivity | Retention |
|---|---|
| S0–S2 | 2 Jahre (dann archivieren oder löschen) |
| S3 | 1 Jahr |
| S4 | 6 Monate (kürzer wegen Intimsphäre) |

**DSGVO-Anforderung:** Auf explizite Anfrage müssen alle personenbezogenen Daten — inklusive Audit-Logs — gelöscht werden können. Implementierung: Geplant für Phase 8 (Hardening).

---

## Beispiel-Audit-Log-Einträge

### Turn-Verarbeitung

```json
{
  "event_type": "turn_processed",
  "channel": "web",
  "result": "success",
  "sensitivity": "S0",
  "payload": {
    "intent": "work",
    "provider": "deepseek",
    "model": "deepseek-chat",
    "tokens_used": 1234,
    "claims_extracted": 2,
    "proposals_created": 2
  },
  "source_ref": "turn-uuid-123"
}
```

### Proposal bestätigt

```json
{
  "event_type": "memory_confirmed",
  "channel": "web",
  "result": "success",
  "sensitivity": "S0",
  "payload": {
    "proposal_id": "proposal-uuid-456"
  },
  "source_ref": "turn-uuid-123"
}
```

### Circuit Breaker ausgelöst

```json
{
  "event_type": "circuit_breaker_tripped",
  "channel": "web",
  "result": "blocked",
  "sensitivity": "S0",
  "payload": {
    "action_type": "llm_turn",
    "current_count": 21,
    "max_allowed": 20,
    "cooldown_seconds": 120
  }
}
```

### Decay-Job abgeschlossen

```json
{
  "event_type": "action_executed",
  "channel": "celery",
  "result": "success",
  "sensitivity": "S0",
  "payload": {
    "actions": {
      "keep": 45,
      "reduce_confidence": 8,
      "expire": 2,
      "archive": 1
    }
  },
  "source_ref": "decay-job"
}
```

---

## Monitoring-Integration

Für Echtzeit-Monitoring von kritischen Audit-Events: Siehe [`OZY_MONITORING.md`](OZY_MONITORING.md).

Besonders wichtig: Alerts bei `sensitivity_violation`, `circuit_breaker_tripped`, und `action_blocked`-Events.
