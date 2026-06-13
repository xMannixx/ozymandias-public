# Ozymandias — Dokumentationsindex

> Persönliche KI-Schaltzentrale. Autonomer Assistent mit langfristigem Memory, Sensitivity-basiertem Privacy-Routing, gehärteter Governance und vollständigem Audit-Trail.

---

## Verzeichnisstruktur

```
docs/
├── INDEX.md                  ← Du bist hier
├── ARCHITECTURE.md           ← Systemarchitektur, Schichtenmodell
├── sbom/                     ← Software & ML Bill of Materials
│   ├── sbom.cdx.json         ← SBOM (CycloneDX 1.6): alle Abhängigkeiten
│   └── ml-bom.cdx.json       ← ML-BOM (CycloneDX 1.6): Modelle, Provider, KI-Infrastruktur
├── spec/                     ← Kern-Spezifikationen
│   ├── OZY_ZUSAMMENFASSUNG_v5_2026-04-03.md
│   ├── OZY_CONTRACTS_SPEC_v1_2026-04-03.md
│   ├── OZY_MEMORY_SYSTEM.md
│   ├── OZY_WRITE_GATES.md
│   ├── SENSITIVITY_ROUTING.md
│   ├── OZY_LLM_ROUTING.md
│   ├── OZY_AUDIT_TRAIL.md
│   ├── TURN_PIPELINE.md
│   ├── RUST_CORE.md
│   ├── LLM_PROVIDERS.md
│   ├── OZY_CELERY_TASKS.md
│   ├── OZY_DB_Schema.sql
│   ├── OZY_DB_GUIDE.md
│   ├── OZY_PROVIDER_CONFIG.md
│   └── OZY_SOFTWARE_VERSIONEN.md
├── api/                      ← API- & Frontend-Referenz
│   ├── OZY_API_REFERENCE.md
│   └── FRONTEND.md
├── deployment/               ← Deployment & Ops
│   ├── OZY_DEPLOYMENT.md
│   ├── OZY_BACKUP_RESTORE.md
│   └── OZY_MONITORING.md
├── adr/                      ← Architecture Decision Records
│   └── (zukünftige ADRs)
```

---

## Schnellnavigation

### Einstieg

| Dokument | Inhalt |
|---|---|
| [`../README.md`](../README.md) | Projektübersicht, Schnellstart, Tech-Stack |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Systemarchitektur, Schichtenmodell, Datenfluss |
| [`../REQUIREMENTS.md`](../REQUIREMENTS.md) | Abhängigkeiten, Versionsmatrix |
| [`spec/OZY_SOFTWARE_VERSIONEN.md`](spec/OZY_SOFTWARE_VERSIONEN.md) | Detaillierte Software-Versionen |

### Bill of Materials

| Dokument | Inhalt |
|---|---|
| [`sbom/sbom.cdx.json`](sbom/sbom.cdx.json) | SBOM (CycloneDX 1.6): Python-, Rust-, Frontend- und Infrastruktur-Abhängigkeiten |
| [`sbom/ml-bom.cdx.json`](sbom/ml-bom.cdx.json) | ML-BOM (CycloneDX 1.6): LLM-Modelle, Provider-Services, ML-Bibliotheken, pgvector, interne ML-Bausteine |

### Kern-Konzepte

| Dokument | Inhalt |
|---|---|
| [`spec/RUST_CORE.md`](spec/RUST_CORE.md) | `ozy-contracts` + `ozy-core` + `ozy-bindings` vollständig |
| [`spec/OZY_MEMORY_SYSTEM.md`](spec/OZY_MEMORY_SYSTEM.md) | Die 4 Speicherschichten, Claims, Decay, Dual-Axis + Memory v2 (Authority Lanes, query-aware Recall, Verhaltensregeln) |
| [`spec/OZY_WRITE_GATES.md`](spec/OZY_WRITE_GATES.md) | Die 5 Write-Gates G1–G5 |
| [`spec/SENSITIVITY_ROUTING.md`](spec/SENSITIVITY_ROUTING.md) | S0–S4, Taint-Tracker, Payload-Checks, Provider-Routing, Klassifikator-Resilienz & Live-Web |
| [`spec/OZY_CONTRACTS_SPEC_v1_2026-04-03.md`](spec/OZY_CONTRACTS_SPEC_v1_2026-04-03.md) | Vollständige Typ-Spezifikation (Rust-Contracts) |

### Backend

| Dokument | Inhalt |
|---|---|
| [`spec/TURN_PIPELINE.md`](spec/TURN_PIPELINE.md) | Turn-Orchestrierung Schritt für Schritt |
| [`api/OZY_API_REFERENCE.md`](api/OZY_API_REFERENCE.md) | Vollständige REST-API-Referenz |
| [`spec/LLM_PROVIDERS.md`](spec/LLM_PROVIDERS.md) | Alle Provider, Router-Logik, Konfiguration, Classifier-Resilienz |
| [`spec/OZY_LLM_ROUTING.md`](spec/OZY_LLM_ROUTING.md) | Intent-basiertes Routing, Provider-Resilienz, Live-Web |
| [`spec/OZY_CELERY_TASKS.md`](spec/OZY_CELERY_TASKS.md) | Hintergrund-Tasks: Decay, Batch-Extraktion |
| [`spec/OZY_AUDIT_TRAIL.md`](spec/OZY_AUDIT_TRAIL.md) | Audit-System, Event-Typen, S4-Sichtbarkeit |

### Frontend

| Dokument | Inhalt |
|---|---|
| [`api/FRONTEND.md`](api/FRONTEND.md) | React-App, alle Seiten, Store, API-Client-Layer |

### Datenbank & Infrastruktur

| Dokument | Inhalt |
|---|---|
| [`spec/OZY_DB_GUIDE.md`](spec/OZY_DB_GUIDE.md) | DB-Übersicht, Abfrage-Patterns, Migration |
| [`spec/OZY_DB_Schema.sql`](spec/OZY_DB_Schema.sql) | Vollständiges SQL-Schema |
| [`deployment/OZY_DEPLOYMENT.md`](deployment/OZY_DEPLOYMENT.md) | Docker Compose, Nginx, VPS-Setup |
| [`deployment/OZY_BACKUP_RESTORE.md`](deployment/OZY_BACKUP_RESTORE.md) | Backup-Strategie, Restore-Prozeduren |
| [`deployment/OZY_MONITORING.md`](deployment/OZY_MONITORING.md) | Health-Check, Metriken, Alerting |
| [`spec/OZY_PROVIDER_CONFIG.md`](spec/OZY_PROVIDER_CONFIG.md) | LLM-Provider-Konfiguration, `.env`-Referenz |

### Spezifikationen & Planung

| Dokument | Inhalt |
|---|---|
| [`spec/OZY_ZUSAMMENFASSUNG_v5_2026-04-03.md`](spec/OZY_ZUSAMMENFASSUNG_v5_2026-04-03.md) | Vollständige System-Spec (Vision, Architektur, alle Konzepte) |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Was hat sich wann geändert |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Beitragen, Entwicklungsworkflow |
| [`../SECURITY.md`](../SECURITY.md) | Security Policy, Vulnerability Reporting |

---

## Kernprinzipien

1. **Boundary-first** — Rust ist der strenge Notar. Python ist der flexible Dirigent.
2. **Fail-closed** — Kein Gate kann übersprungen werden. Bei Fehler: ablehnen, loggen.
3. **Privacy-first** — S3/S4-Daten verlassen nie das lokale System.
4. **Audit-always** — Jede sicherheitsrelevante Aktion landet im Audit-Log.
5. **No direct writes** — Kein LLM schreibt direkt in die DB. Alles über Proposals.
6. **Dual-Axis** — Confidence (Wahrheit) ≠ Relevance (Wichtigkeit). Kein Self-Reinforcement.
