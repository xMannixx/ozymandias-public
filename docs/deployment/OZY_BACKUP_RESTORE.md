# OZY Backup und Restore

> Infrastruktur: `docker-compose.yaml` (`pg-backup`-Service)  
> Daten: PostgreSQL-Volume `postgres_data`, MinIO-Volume `minio_data`  
> Deployment: `docs/OZY_DEPLOYMENT.md`

---

## Überblick

Ozymandias speichert alle kritischen Daten in zwei Systemen:

1. **PostgreSQL** (`postgres_data` Volume) — Claims, Memory, Audit-Log, Projekte, Kontakte, Settings, OAuth-Tokens
2. **MinIO** (`minio_data` Volume) — Hochgeladene Dateien, Kontakt-Avatare, Projekt-Anhänge

Beide Systeme müssen regelmäßig gesichert werden.

> ⚠️ **CRITICAL**: Der `postgres_data`-Volume enthält **alle Claims und das gesamte Memory** von Ozymandias. Ein Verlust dieses Volumes bedeutet den vollständigen Verlust aller gespeicherten Fakten, Gesprächsgeschichte und Konfiguration.

---

## Automatische Backups (bereits konfiguriert)

### PostgreSQL-Backup-Container

Der `pg-backup`-Container in `docker-compose.yaml` erstellt automatisch tägliche Backups:

```yaml
pg-backup:
  image: postgres:17-alpine
  container_name: ozy-pg-backup
  volumes:
    - pg_backups:/backups
  command: >
    sh -c "
    while true; do
      TS=$$(date +%Y%m%d_%H%M);
      pg_dump -h postgres -U postgres ozymandias | gzip > /backups/ozy_backup_$${TS}.sql.gz;
      find /backups -name 'ozy_backup_*.sql.gz' -mtime +7 -delete;
      sleep 86400;
    done
    "
```

**Was wird gesichert:** Vollständiger `pg_dump` der `ozymandias`-Datenbank  
**Format:** Komprimiertes SQL (`.sql.gz`)  
**Zeitplan:** Einmal täglich (alle 86400 Sekunden = 24h)  
**Retention:** 7 Tage (ältere Backups werden automatisch gelöscht)  
**Speicherort:** Docker-Volume `pg_backups`

### Backup-Status prüfen

```bash
# Verfügbare Backup-Dateien anzeigen
docker exec ozy-pg-backup ls -lh /backups/

# Letztes Backup-Datum
docker exec ozy-pg-backup ls -lt /backups/ | head -5

# Backup-Größen
docker exec ozy-pg-backup du -sh /backups/*
```

---

## Manuelles Backup

### PostgreSQL vollständig sichern

```bash
# Backup erstellen (lokal auf dem Host)
docker exec ozy-postgres pg_dump \
  -U postgres ozymandias | gzip > ozy_backup_$(date +%Y%m%d_%H%M).sql.gz

# Backup in bestimmtes Verzeichnis
docker exec ozy-postgres pg_dump -U postgres ozymandias \
  > /backup/ozy_full_$(date +%Y%m%d).sql
```

### Nur bestimmte Tabellen sichern

```bash
# Nur Claims und Proposals (kritische Memory-Daten)
docker exec ozy-postgres pg_dump \
  -U postgres ozymandias \
  -t claims \
  -t claim_versions \
  -t memory_proposals \
  -t conflict_groups \
  -t procedural_rules \
  -t episodes \
  | gzip > ozy_memory_$(date +%Y%m%d).sql.gz

# Nur Audit-Log
docker exec ozy-postgres pg_dump \
  -U postgres ozymandias \
  -t audit_log \
  | gzip > ozy_audit_$(date +%Y%m%d).sql.gz
```

### MinIO-Backup

```bash
# MinIO Client (mc) installieren
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# MinIO-Verbindung konfigurieren
mc alias set ozy http://localhost:9000 pic_minio pic_minio_secret_change_me

# Bucket-Inhalt sichern
mc mirror ozy/ozy-files ./backup/minio-$(date +%Y%m%d)/
```

---

## Restore

### PostgreSQL wiederherstellen

> ⚠️ **WARNUNG**: Ein Restore überschreibt alle aktuellen Daten. Nur nach Datenverlust oder bei explizitem Bedarf durchführen.

```bash
# 1. Laufende Services stoppen (außer Postgres)
docker compose stop backend frontend nginx

# 2. Bestehende Datenbank löschen und neu erstellen
docker exec ozy-postgres psql -U postgres -c "DROP DATABASE IF EXISTS ozymandias;"
docker exec ozy-postgres psql -U postgres -c "CREATE DATABASE ozymandias;"
docker exec ozy-postgres psql -U postgres -d ozymandias -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker exec ozy-postgres psql -U postgres -d ozymandias -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# 3a. Aus komprimiertem Backup (aus pg-backup Container)
docker exec ozy-pg-backup sh -c "zcat /backups/ozy_backup_20260401_0300.sql.gz | psql -h postgres -U postgres ozymandias"

# 3b. Aus unkomprimierter SQL-Datei
cat backup.sql | docker exec -i ozy-postgres psql -U postgres ozymandias

# 4. Services wieder starten
docker compose start backend frontend nginx

# 5. Health-Check
curl http://localhost:8080/health
```

### MinIO wiederherstellen

```bash
# Alle Dateien aus lokalem Backup wiederherstellen
mc mirror ./backup/minio-20260401/ ozy/ozy-files
```

---

## Off-Site-Backup (Empfohlen für Produktion)

Der automatische Backup-Container speichert nur im `pg_backups`-Volume auf demselben Server. Bei einem Server-Totalausfall gehen auch diese Backups verloren. Empfehlung: Regelmäßige Übertragung auf externen Speicher.

### Beispiel: Backup auf lokalen PC übertragen

```bash
# Auf dem VPS: Backup-Datei extrahieren
docker cp ozy-pg-backup:/backups/ozy_backup_$(date +%Y%m%d)_*.sql.gz .

# Vom lokalen PC: SCP-Download
scp user@vps-ip:~/ozy_backup_*.sql.gz ./local-backups/

# Oder: Automatisiert per Cron (auf lokalem PC)
# 0 4 * * * scp user@vps-ip:~/ozy_backup_$(date +\%Y\%m\%d)_*.sql.gz ~/ozy-backups/
```

### Beispiel: S3-kompatibler Cloud-Speicher

```bash
# MinIO Client (mc) für externen S3
mc alias set cloudbackup https://s3.amazonaws.com ACCESS_KEY SECRET_KEY

# Tägliches Backup-Sync
mc mirror /backups/ cloudbackup/ozy-backups/ --newer-than 1d
```

---

## Disaster-Recovery-Plan

### Szenario 1: Volume versehentlich gelöscht (`down -v`)

1. Neueste Off-Site-Backup-Datei herunterladen
2. `docker compose up postgres -d` (nur Postgres starten)
3. Restore-Prozedur (siehe oben)
4. `docker compose up -d` (alle Services starten)
5. Health-Check durchführen
6. Ersten Test-Turn ausführen und prüfen ob Memory vorhanden

### Szenario 2: Server-Totalausfall

1. Neuen VPS provisionieren
2. Docker installieren
3. Repository klonen
4. `.env` aus gesicherter Kopie wiederherstellen
5. `docker compose up postgres -d`
6. Off-Site-Backup einspielen
7. `docker compose up -d`

### Szenario 3: Datenbankkorruption

1. Postgres stoppen: `docker compose stop postgres`
2. Backup einspielen (aus `pg_backups`-Volume oder Off-Site)
3. Postgres neu starten
4. Hash-Chain-Integrität prüfen (siehe `OZY_DB_GUIDE.md`)

---

## DSGVO und Datenlöschung

Als Single-Owner-System sind alle Daten deine eigenen. Falls du alle Daten löschen möchtest:

```bash
# ALLE Ozymandias-Daten unwiderruflich löschen
docker compose down -v  # Löscht alle Volumes inkl. Postgres und MinIO

# Nur Claims löschen (Memory-Reset), Einstellungen behalten
docker exec ozy-postgres psql -U postgres ozymandias -c "
  TRUNCATE claims, claim_versions, claim_access_log,
           conflict_groups, memory_proposals, episodes CASCADE;
"
```

**Geplant für Phase 8 (Hardening):** Granulare DSGVO-konforme Löschfunktion über das Dashboard ("Lösche alle Daten über mich").

---

## Backup-Monitoring

### Letztes Backup-Datum automatisch prüfen

```bash
# Prüfen ob Backup heute erstellt wurde
LATEST=$(docker exec ozy-pg-backup ls -t /backups/ | head -1)
LATEST_DATE=$(echo $LATEST | grep -oP '\d{8}')
TODAY=$(date +%Y%m%d)

if [ "$LATEST_DATE" != "$TODAY" ]; then
  echo "WARNING: No backup today! Latest: $LATEST"
fi
```

Für Prometheus/Alerting-Integration: Siehe [`OZY_MONITORING.md`](OZY_MONITORING.md).
