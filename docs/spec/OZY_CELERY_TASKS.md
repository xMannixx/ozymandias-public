# OZY Celery-Tasks — Technische Spezifikation

> Implementiert in: `backend/app/services/` (`decay_service`, `memory_lifecycle_service`, `episode_index_service`, `briefing_service`)  
> Konfiguration: `backend/app/config.py` (Redis-URL, Decay-Parameter, `embedding_model`)  
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

Die Celery-Applikation liegt in `backend/app/celery_app.py`. Sie nutzt `settings.redis_url` als Broker und Result-Backend, serialisiert JSON, arbeitet in UTC und importiert die Task-Module über `include`:

```python
celery_app = Celery(
    "ozymandias",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.services.briefing_service",
        "app.services.decay_service",
        "app.services.episode_index_service",
        "app.services.memory_lifecycle_service",
    ],
)
```

Weitere Defaults: `task_time_limit=1800`, `task_soft_time_limit=1500`, `task_acks_late=True`, `worker_max_tasks_per_child=100`, `result_expires=86400`.

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

Der Service `worker` in `docker-compose.yaml` baut dasselbe Image wie `backend`, startet aber Worker und Beat in einem Prozessbaum:

```yaml
command: celery -A app.celery_app worker --beat --loglevel=info
```

Der Backend-Container startet **keinen** Worker. Bei der Single-Owner-Architektur genügt ein Worker-Container; er hängt an `db-init` (abgeschlossen) sowie `redis` und `minio`.

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
- Über `ozy.decay.run_all` durch Celery Beat
- Manuell per `celery -A app.celery_app call ozy.decay.run --args='["<user_id>"]'`

### `ozy.memory.cleanup` — Lane-Decay und Ablauf-Aufräumen

**Datei:** `backend/app/services/memory_lifecycle_service.py`

**Zweck:** Konfidenz pro Lane abklingen lassen, abgelaufene Claims zurückziehen, abgelaufene Recall-Snippets und Entity-Graph-Zeilen löschen, abgelaufene Behavioral Rules zurück auf `pending` setzen.

**Eingabe:** `user_id: str`

**Ausgabe:** Zähler pro Kategorie, Decay-Zähler mit Präfix `decay_`.

### `ozy.episodes.index` — Episoden-Index für semantischen Recall

**Datei:** `backend/app/services/episode_index_service.py`

**Zweck:** Neue `conversation_messages` embedden und als `episodes` schreiben, damit der Turn über `EpisodeRecallService` in alten Gesprächen suchen kann.

**Eingabe:** `user_id: str`

**Ausgabe:** `{"messages": int, "embedded": int, "skipped": int}`

**Ablauf:**
1. Nachrichten ohne passende Episode laden (`conversation_id` + `seq`), älteste zuerst, max. 500 pro Lauf
2. Inhalte ab 25 Zeichen in Batches von 16 gegen Ollama embedden (`nomic-embed-text`, 768 Dimensionen)
3. Episoden schreiben — Rolle, Inhalt und Sensitivity der Nachricht bleiben erhalten
4. Audit-Log-Eintrag (`event_type: action_executed, channel: celery`)

**Wichtig:** Embeddings entstehen ausschließlich lokal, weil Gesprächsinhalte jede Sensitivity haben können. Ist Ollama nicht erreichbar, schreibt der Lauf **nichts** und die Nachrichten bleiben für den nächsten Durchgang liegen; vektorlose Episoden wären als erledigt markiert und nie wieder auffindbar. Zu kurze Nachrichten werden bewusst ohne Vektor gespeichert.

### `ozy.heartbeat` — Tages-Briefing

**Datei:** `backend/app/services/briefing_service.py`

**Zweck:** Kalender, ungelesene Mails, offene Proposals, Claims mit Review-Bedarf oder baldigem Ablauf und überfällige Projekt-Aufgaben zu einem Text zusammenfassen und in `briefings` schreiben.

**Eingabe:** `user_id: str`

**Ausgabe:** Die `briefing_id`, oder ein leerer String, wenn es für den Tag schon eines gibt.

**Kein LLM:** Mail-Betreffe und Kalendereinträge sind untrusted. Der Text entsteht aus einer Vorlage — das passt zum Taint-Konzept und ist um sieben Uhr morgens zuverlässiger. Jede Quelle wird einzeln abgesichert: ohne Google-Konto entfallen Kalender- und Mail-Abschnitt, der Rest wird trotzdem geschrieben.

**Idempotenz:** `UNIQUE (user_id, briefing_date)` plus Vorabprüfung — der stündliche Beat erzeugt pro Tag genau ein Briefing.

### `ozy.decay.run_all`, `ozy.memory.cleanup_all`, `ozy.episodes.index_all`, `ozy.heartbeat.run_all` — Beat-Einstiegspunkte

**Dateien:** dieselben Service-Module

Beat kennt keine `user_id`. Die Tasks ermitteln ihre Zielnutzer selbst über `backend/app/services/job_targets.py`:

| Task | Zielnutzer |
|---|---|
| `ozy.decay.run_all`, `ozy.memory.cleanup_all` | `user_ids_with_claims` — `SELECT DISTINCT user_id FROM claims` |
| `ozy.episodes.index_all` | `user_ids_with_conversations` — wer chattet, hat noch lange keinen bestätigten Claim |
| `ozy.heartbeat.run_all` | `user_ids_wanting_a_briefing` — `briefing_enabled` und `briefing_hour` = aktuelle UTC-Stunde |

**Ausgabe:** `{user_id: <Ergebnis des Ein-User-Jobs>}`

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

Bis dahin bleibt der Weg: `episodes` leeren, dann `ozy.episodes.index_all` neu laufen lassen.

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

```bash
docker compose logs -f worker
```

### Task manuell triggern (Entwicklung)

```bash
# Alle User (wie Beat es tut)
docker compose exec worker celery -A app.celery_app call ozy.decay.run_all
docker compose exec worker celery -A app.celery_app call ozy.memory.cleanup_all
docker compose exec worker celery -A app.celery_app call ozy.episodes.index_all
docker compose exec worker celery -A app.celery_app call ozy.heartbeat.run_all

# Ein einzelner User
docker compose exec worker celery -A app.celery_app call ozy.decay.run --args='["<user_id>"]'
docker compose exec worker celery -A app.celery_app call ozy.heartbeat --args='["<user_id>"]'
```

```python
# In Python-Shell oder Test
from app.services.decay_service import run_decay_task

# Asynchron (Celery-Queue)
run_decay_task.delay("dev-user")

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
| Ollama nicht erreichbar | `ozy.episodes.index_all` schreibt nichts und versucht es beim nächsten Lauf erneut; der Recall im Turn bleibt still leer |
| Kein Google-Konto | Briefing entsteht ohne Kalender- und Mail-Abschnitt |

**Retry-Konfiguration** (Standard-Celery-Verhalten, kann in `celery_app.py` angepasst werden):
- Max Retries: 3
- Retry-Delay: 60 Sekunden (exponentiell)
- Dead Letter Queue: Nicht konfiguriert (Tasks die nach 3 Retries fehlschlagen, werden verworfen)

---

## Celery Beat — Periodische Tasks

Beat läuft eingebettet im `worker`-Container. Der aktive Zeitplan in `backend/app/celery_app.py`:

```python
celery_app.conf.beat_schedule = {
    "decay-all-users": {
        "task": "ozy.decay.run_all",
        "schedule": crontab(hour="3", minute="0"),
    },
    "memory-cleanup-all-users": {
        "task": "ozy.memory.cleanup_all",
        "schedule": crontab(hour="3", minute="30"),
    },
    "index-episodes": {
        "task": "ozy.episodes.index_all",
        "schedule": crontab(minute="*/30"),
    },
    "daily-briefing": {
        "task": "ozy.heartbeat.run_all",
        "schedule": crontab(minute="5"),
    },
}
```

| Zeitplan (UTC) | Task | Warum so oft |
|---|---|---|
| 03:00 täglich | `ozy.decay.run_all` | Nachts, wenn niemand mit den Claims arbeitet |
| 03:30 täglich | `ozy.memory.cleanup_all` | 30 Minuten Versatz, damit beide Jobs nicht dieselben Claims schreiben |
| alle 30 Minuten | `ozy.episodes.index_all` | Heutige Gespräche sind morgen auffindbar, ohne das lokale Modell dauerhaft zu beschäftigen |
| stündlich, Minute 5 | `ozy.heartbeat.run_all` | Jeder darf seine eigene Briefing-Stunde wählen; der Task filtert selbst |

Zeiten sind UTC (`enable_utc=True`) — auch `user_settings.briefing_hour`.

**Hinweis:** Die `run_all`-Tasks lösen die Zielnutzer selbst aus den Daten auf, statt eine feste `DEFAULT_USER_ID` zu setzen — das funktioniert auch bei der Single-Owner-Architektur ohne zusätzliche Konfiguration.
