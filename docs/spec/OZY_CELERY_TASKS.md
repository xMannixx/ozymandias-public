# OZY Celery-Tasks — Technische Spezifikation

> Implementiert in: `backend/app/services/decay_service.py`  
> Konfiguration: `backend/app/config.py` (Redis-URL, Decay-Parameter)  
> Referenz: `OZY_MEMORY_SYSTEM.md` §Memory Decay

---

## Überblick

Ozymandias verwendet **Celery** als Task-Queue für asynchrone Hintergrundaufgaben. Redis dient als Broker und Result-Backend.

Celery wird für alle Aufgaben verwendet, die:
- Nicht im Anfrage-Antwort-Zyklus eines Turns ausgeführt werden können
- Regelmäßig (periodisch) ausgeführt werden müssen
- Potentiell lange laufen (z.B. Batch-Verarbeitung von Episoden)

---

## Infrastruktur

### Broker und Backend

```env
REDIS_URL=redis://redis:6379/0
```

Redis wird sowohl als Celery-Broker (Task-Queue) als auch als Result-Backend verwendet. Dieselbe Redis-Instanz wird auch für den Circuit Breaker genutzt (verschiedene Key-Prefixes vermeiden Konflikte).

### Celery-App-Konfiguration

Die Celery-Applikation wird in `backend/app/` konfiguriert (Celery-App-Instanz + Autodiscovery der Tasks in `services/`).

### Worker starten

```bash
# Development (im backend/-Verzeichnis)
celery -A app.celery_app worker --loglevel=info

# Mit Celery Beat (periodische Tasks)
celery -A app.celery_app beat --loglevel=info

# Beide kombiniert (nur für Entwicklung)
celery -A app.celery_app worker --beat --loglevel=info
```

### In Docker Compose

Der Backend-Container startet automatisch den Celery-Worker zusammen mit dem FastAPI-Server. Für Produktionsumgebungen empfiehlt sich ein separater Container für Worker und Beat.

---

## Implementierte Tasks

### `ozy.decay.run` — Memory-Decay-Job

**Datei:** `backend/app/services/decay_service.py`

```python
@shared_task(name="ozy.decay.run")
def run_decay_task(user_id: str) -> dict[str, int]:
    """Celery task wrapper around async decay service."""
    return asyncio.run(_run_decay_job(user_id))
```

**Zweck:** Wendet die Rust-Decay-Logik auf alle decay-eligible Claims eines Users an.

**Eingabe:**
- `user_id: str` — Der User, dessen Claims bewertet werden

**Ausgabe:**
```python
{
    "keep": int,               # Claims die behalten wurden
    "reduce_confidence": int,  # Claims mit reduzierter Konfidenz
    "expire": int,             # Claims die auf retracted gesetzt wurden (Session/Expiry)
    "archive": int             # Claims die archiviert wurden (Confidence < 0.3)
}
```

**Ablauf:**
1. Alle `decay_eligible = true` und `verification_state != retracted` Claims des Users laden
2. `ClaimData`-Objekte aus DB-Modellen erstellen
3. `rust_bridge.evaluate_decay(claims, now_iso)` aufrufen → Liste von `DecayAction`
4. Aktionen anwenden:
   - `Keep` → Nichts tun
   - `ReduceConfidence { new_confidence }` → `claim.confidence = new_confidence`
   - `Expire` → `claim.verification_state = "retracted"`
   - `Archive` → `claim.verification_state = "retracted"` + `claim.superseded_at = now()`
5. DB-Commit
6. Audit-Log-Eintrag (`event_type: action_executed, channel: celery`)

**Konfigurierbare Parameter** (via `user_settings`):
- `decay_interval_hours`: Wie oft der Job läuft (Standard: 24h)
- `decay_confidence_threshold`: Unter welcher Schwelle Claims archiviert werden (Standard: 0.1)

**Trigger:**
- Periodisch via Celery Beat (konfiguriertes Intervall per User)
- Manuell über Admin-Endpoint (für Tests/Debugging)

---

## Geplante Tasks (noch nicht implementiert)

Die folgenden Tasks sind in der Architektur vorgesehen und sollen in späteren Phasen implementiert werden:

### `ozy.extract.claims` — Claim-Extraktion aus Episoden

**Zweck:** Batch-Verarbeitung unextrahierter Episoden → Claims

**Ablauf (geplant):**
1. Episoden mit `extracted = false` laden (batch-weise, z.B. 50 pro Lauf)
2. DeepSeek Batch-API oder Standard-API für Extraktion nutzen
3. Extrahierte Claims als Proposals erstellen (SourceType: `model_inferred`)
4. `extracted = true` + `extraction_job_id` setzen
5. Audit-Log-Eintrag

**Trigger:** Nachtjob (2–4 Uhr) via Celery Beat

### `ozy.memory.consolidate` — Memory-Konsolidierung

**Zweck:** Ähnliche Claims zusammenführen, veraltete Superseded-Claims physisch löschen (nach Retention-Policy)

**Ablauf (geplant):**
1. Superseded/Retracted Claims älter als Retention-Policy identifizieren
2. Claims ohne aktive Referenzen in Versionshistorie prüfen
3. Physische Löschung (nur nach expliziter User-Bestätigung oder konfigurierter Auto-Policy)
4. Embedding-Reindex falls nötig

### `ozy.embeddings.reindex` — Vektoren neu berechnen

**Zweck:** Wenn das Embedding-Modell wechselt, müssen alle `episodes`-Embeddings neu berechnet werden

**Ablauf (geplant):**
1. Alle Episoden paginiert laden
2. Embedding mit neuem Modell berechnen
3. `episodes.embedding` aktualisieren

### `ozy.heartbeat` — Tages-Briefing vorbereiten

**Zweck:** Jeden Morgen einen Kontext-Snapshot für den Nutzer vorbereiten (relevante Claims, offene Tasks, Kalender)

**Trigger:** Täglich um 9 Uhr (konfigurierbar)

---

## Monitoring und Debugging

### Task-Status prüfen

```bash
# Celery Worker-Status
celery -A app.celery_app inspect active

# Geplante Tasks anzeigen
celery -A app.celery_app inspect scheduled

# Task-Statistiken
celery -A app.celery_app inspect stats
```

### Fehlgeschlagene Tasks

```bash
# Flower (Celery-Monitoring-UI) starten
pip install flower
celery -A app.celery_app flower --port=5555
# http://localhost:5555
```

### Logs

Celery-Logs erscheinen im Backend-Container-Log:
```bash
docker compose logs -f backend | grep "celery\|ozy.decay\|ozy.extract"
```

### Task manuell triggern (Entwicklung)

```python
# In Python-Shell oder Test
from app.services.decay_service import run_decay_task

# Asynchron (Celery-Queue)
run_decay_task.delay(user_id="dev-user")

# Synchron (ohne Celery-Worker)
run_decay_task.apply(args=["dev-user"])
```

---

## Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| DB nicht erreichbar | Task schlägt fehl, Celery-Retry nach konfigurierbarem Intervall |
| Rust-Bridge-Fehler | Task schlägt fehl, kein partieller Commit |
| Leere Claims-Liste | Task endet erfolgreich mit `{"keep": 0, ...}` |
| Redis nicht erreichbar | Celery kann keine Tasks empfangen — System läuft weiter, nur Background-Jobs fehlen |

**Retry-Konfiguration** (Standard-Celery-Verhalten, kann in `celery_app.py` angepasst werden):
- Max Retries: 3
- Retry-Delay: 60 Sekunden (exponentiell)
- Dead Letter Queue: Nicht konfiguriert (Tasks die nach 3 Retries fehlschlagen, werden verworfen)

---

## Celery Beat — Periodische Tasks

Celery Beat plant und triggert periodische Tasks. Die Beat-Konfiguration definiert den Zeitplan:

```python
# app/celery_app.py (geplante Konfiguration)
app.conf.beat_schedule = {
    "decay-all-users": {
        "task": "ozy.decay.run",
        "schedule": crontab(hour=3, minute=0),  # Täglich um 3 Uhr
        "args": (DEFAULT_USER_ID,),
    },
    "extract-claims-nightly": {
        "task": "ozy.extract.claims",
        "schedule": crontab(hour=2, minute=0),  # Täglich um 2 Uhr
    },
}
```

**Hinweis:** Da Ozymandias Single-Owner-Architektur hat, gibt es aktuell nur einen User-Kontext für Celery-Tasks.
