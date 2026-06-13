# OZY Monitoring

> Health-Endpunkt: `GET /health`  
> Audit-Trail: `GET /audit`  
> Stats-Endpunkt: `GET /stats`  
> Deployment: `docs/OZY_DEPLOYMENT.md`

---

## Überblick

Ozymandias stellt mehrere Monitoring-Endpunkte bereit. Das Monitoring ist darauf ausgerichtet, drei Dinge zu überwachen:

1. **System-Gesundheit**: Läuft alles? Datenbank, Redis, Rust-Bindings, LLM-Provider
2. **Security-Events**: Sensitivity-Violations, Circuit-Breaker-Trips, blockierte Aktionen
3. **Betriebsstatus**: Decay-Jobs, Token-Verbrauch, Memory-Wachstum

---

## Health-Endpunkt

### GET `/health`

Kein Token erforderlich. Gibt den aktuellen Status aller Systemkomponenten zurück.

```bash
curl http://localhost:8080/health | python3 -m json.tool
```

**Erwartete Antwort (alles OK):**
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "rust_bindings": "ok",
  "llm_providers": ["deepseek", "openai", "ollama"]
}
```

**Mögliche Status-Werte:**

| Feld | OK | Problem |
|---|---|---|
| `status` | `"ok"` | `"error"` |
| `database` | `"ok"` | Exception (500er) |
| `redis` | `"ok"` | `"unavailable"` |
| `rust_bindings` | `"ok"` | `"dev-fallback"` oder Exception |
| `llm_providers` | Liste mit min. `"ollama"` | Leere Liste |

**Kritischer Zustand:** Wenn `llm_providers` leer ist oder `database` nicht `"ok"` ist, funktioniert das System nicht korrekt.

---

## Einfaches Uptime-Monitoring

### Curl-basiertes Skript

```bash
#!/bin/bash
# /usr/local/bin/ozy-healthcheck.sh

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)

if [ "$RESPONSE" != "200" ]; then
    echo "ALERT: Ozymandias health check failed! HTTP $RESPONSE"
    # Hier: Telegram-Benachrichtigung, E-Mail, etc.
fi

# Prüfe ob lokaler Provider verfügbar (Pflicht für S3/S4)
PROVIDERS=$(curl -s http://localhost:8080/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(' '.join(d.get('llm_providers',[])));")
if [[ "$PROVIDERS" != *"ollama"* ]] && [[ "$PROVIDERS" != *"lmstudio"* ]]; then
    echo "ALERT: No local LLM provider! S3/S4 routing will fail!"
fi
```

Cron-Job einrichten:
```bash
# Alle 5 Minuten prüfen
*/5 * * * * /usr/local/bin/ozy-healthcheck.sh >> /var/log/ozy-health.log 2>&1
```

---

## Logs überwachen

### Docker-Container-Logs

```bash
# Backend-Logs (laufend)
docker compose logs -f backend

# Nur Fehler
docker compose logs backend | grep -i "error\|exception\|traceback"

# LLM-Routing-Events
docker compose logs backend | grep -i "provider\|sensitivity\|circuit"

# Decay-Job-Logs
docker compose logs backend | grep "ozy.decay"

# Alle Services auf einmal
docker compose logs -f --tail=100
```

### Wichtige Log-Patterns

| Pattern | Bedeutung | Priorität |
|---|---|---|
| `"S3/S4 content routed to cloud"` | Sensitivity-Violation (sollte niemals passieren) | 🔴 KRITISCH |
| `"Circuit breaker tripped"` | Rate-Limiting ausgelöst | 🟠 WICHTIG |
| `"No local provider configured"` | S3/S4-Anfragen schlagen fehl | 🟠 WICHTIG |
| `"Invalid audit entry"` | Rust-Validierung fehlgeschlagen | 🟠 WICHTIG |
| `"Decay run completed"` | Decay-Job lief durch | 🟢 INFO |
| `"Provider 'xxx' not configured"` | API-Key fehlt | 🟡 WARNUNG |

---

## Audit-Trail für Security-Monitoring

### Kritische Security-Events täglich prüfen

```bash
# Alle blockierten Aktionen heute
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/audit?result=blocked&after=$(date -d 'yesterday' -Iseconds)" \
  | python3 -m json.tool

# Sensitivity-Violations (sollte immer 0 sein!)
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/audit?event_type=sensitivity_violation" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Violations: {d[\"total\"]}')"

# Circuit-Breaker-Events
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/audit?event_type=circuit_breaker_tripped" \
  | python3 -m json.tool
```

**Goldene Regel:** Der Wert von `sensitivity_violation`-Events muss immer `0` sein. Jeder nicht-null Wert bedeutet, dass ein S3/S4-Datum versucht wurde, an einen Cloud-Provider zu senden.

---

## Stats-Dashboard

### GET `/stats`

Gibt Aggregate über das System zurück (Claim-Anzahl, Token-Verbrauch, etc.).

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/stats" | python3 -m json.tool
```

**Erwartete Felder (je nach Implementierungsstand):**
- Claim-Anzahl nach Verification State
- Token-Verbrauch gesamt und pro Provider
- Proposal-Anzahl nach Status (pending/confirmed/rejected)
- Audit-Event-Häufigkeiten

---

## PostgreSQL-Monitoring

### Datenbankgröße prüfen

```bash
# Datenbankgröße gesamt
docker exec ozy-postgres psql -U postgres ozymandias \
  -c "SELECT pg_size_pretty(pg_database_size('ozymandias'));"

# Größte Tabellen
docker exec ozy-postgres psql -U postgres ozymandias -c "
  SELECT table_name,
         pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS size
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
"

# Anzahl Einträge pro Tabelle
docker exec ozy-postgres psql -U postgres ozymandias -c "
  SELECT 'claims' AS t, COUNT(*) FROM claims
  UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
  UNION ALL SELECT 'episodes', COUNT(*) FROM episodes
  UNION ALL SELECT 'memory_proposals', COUNT(*) FROM memory_proposals;
"
```

### Langsame Queries identifizieren

```bash
docker exec ozy-postgres psql -U postgres ozymandias -c "
  SELECT query, calls, mean_exec_time, total_exec_time
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"
```

(Erfordert `pg_stat_statements`-Extension, nicht standardmäßig aktiviert.)

---

## Redis-Monitoring

### Circuit-Breaker-Status prüfen

```bash
# Alle aktiven Circuit-Breaker-Keys
docker exec ozy-redis redis-cli KEYS "cb:*" | head -20

# Aktuelle Zähler
docker exec ozy-redis redis-cli KEYS "cb:*" | while read key; do
  echo "$key: $(docker exec ozy-redis redis-cli GET "$key")"
done

# Gesperrte User (Trip-Keys)
docker exec ozy-redis redis-cli KEYS "cb_tripped:*"

# Redis-Speichernutzung
docker exec ozy-redis redis-cli INFO memory | grep used_memory_human
```

---

## Prometheus / Grafana (Geplant)

Für produktionsreifes Monitoring ist Prometheus + Grafana geplant (Phase 8 — Hardening). Geplante Metriken:

| Metrik | Typ | Beschreibung |
|---|---|---|
| `ozy_turns_total` | Counter | Verarbeitete Turns |
| `ozy_turn_duration_seconds` | Histogram | Turn-Verarbeitungszeit |
| `ozy_llm_tokens_used_total` | Counter | Token-Verbrauch nach Provider |
| `ozy_claims_total` | Gauge | Aktive Claims nach State |
| `ozy_circuit_breaker_trips_total` | Counter | Circuit-Breaker-Auslösungen |
| `ozy_sensitivity_violations_total` | Counter | **Sollte immer 0 sein** |
| `ozy_decay_actions_total` | Counter | Decay-Aktionen nach Typ |
| `ozy_proposals_pending` | Gauge | Offene Proposals in der Inbox |

---

## Telegram-Benachrichtigungen (Geplant)

Ozymandias wird Telegram als primären mobilen Kanal nutzen. Für das Monitoring bedeutet das:

- Kritische Alerts (Sensitivity-Violations, System-Down) → Telegram-Nachricht
- Täglicher Status-Report → Telegram-Briefing
- Circuit-Breaker-Trip → Sofortige Benachrichtigung

Implementation: Phase 6 (Telegram-Integration).

---

## Tägliche Monitoring-Checkliste

Folgende Checks täglich durchführen (bis Prometheus/Alerting in Phase 8 automatisiert):

```bash
#!/bin/bash
# Täglicher Ozy-Status-Check

echo "=== Ozymandias Daily Health Check ==="
echo "Date: $(date)"
echo ""

echo "--- System Health ---"
curl -s http://localhost:8080/health | python3 -m json.tool

echo ""
echo "--- Security Events (last 24h) ---"
curl -s -H "Authorization: Bearer $OZY_TOKEN" \
  "http://localhost:8080/audit?event_type=sensitivity_violation" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Sensitivity violations: {d[\"total\"]}')"

curl -s -H "Authorization: Bearer $OZY_TOKEN" \
  "http://localhost:8080/audit?result=blocked" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Blocked actions: {d[\"total\"]}')"

echo ""
echo "--- Backup Status ---"
docker exec ozy-pg-backup ls -lt /backups/ | head -3

echo ""
echo "--- Pending Proposals ---"
curl -s -H "Authorization: Bearer $OZY_TOKEN" \
  "http://localhost:8080/proposals?status=pending" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Pending proposals: {len(d)}')"
```
